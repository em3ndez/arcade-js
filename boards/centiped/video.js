// SPDX-License-Identifier: GPL-3.0-only
/**
 * Atari Centipede video renderer, from MAME atari/centiped_v.cpp. Rendered NATIVE 256x240, top-left,
 * UNROTATED; the ROT270 in hardware.json is applied downstream by the pixel-gate/screenshot tooling.
 *
 * ⚠ NOT PIXEL-VALIDATED: the centiped3 dump is missing the sync/decode PROM (136001-213.p4) so MAME
 * cannot produce a golden yet. This is a careful first draft; every non-obvious choice is FLAGGED.
 *
 * Model (centiped_v.cpp):
 *  - Tilemap (centiped_get_tile_info@19): 32x30 8x8, code=(videoram[i]&0x3f)+0x40, COLOR 0, per-tile
 *    flip = TILE_FLIPYX(data>>6) (bit6 flipx, bit7 flipy). Drawn OPAQUE (draw flags 0, no transparent
 *    pen set), so char pen 0 is a real colour -- the background.
 *  - Sprites (screen_update_centiped@414): 16 objs, o=0..15, drawn 0..15 so higher o wins:
 *      code=((pic&0x3e)>>1)|((pic&1)<<6), flipx=pic6, flipy=pic7, x=sram[o+0x20], y=240-sram[o+0x10],
 *      colour=sram[o+0x30]. transmask via penmask[colour&0x3f]. Clip: max_x-=8 (min_x+=8 if flipscreen).
 *  - NO colour PROM (centiped_v.cpp:186): colours come from writable palette RAM 0x1400-0x140F, so the
 *    palette is DYNAMIC and rebuilt from mem.paletteRam every frame (this is why colours cycle per wave).
 *
 * ⚠ FLAGS for review:
 *  [1] PLANE ORDER: gfx_8x8x2_planar/spritelayout use planeoffset {RGN_FRAC(1,2), 0} -> the MSB plane is
 *      the SECOND ROM half (offset 0x800), LSB is the first (offset 0). This is OPPOSITE boards/galaxian,
 *      whose validated decode has MSB=first half. A wrong order silently swaps pens 1<->2. (centiped.cpp:1735)
 *  [2] flipscreen affects ONLY the sprite clip in centiped's screen_update -- the tilemap/sprite coords are
 *      NOT flipped there (cocktail mirroring is software-driven in the ROM). Default is upright (flip=0),
 *      so this does not affect the primary golden. Not modelling a tilemap flip.
 *  [3] Sprite priority: MAME paints o=0..15 with later overwriting earlier -> higher o on top; replicated.
 *  [4] "alternate" palette bit (bit3): b!=0 -> b=0xc0, else g!=0 -> g=0xc0 (centiped_v.cpp:226). The
 *      driver itself calls this weighting "not perfectly accurate"; copied verbatim.
 */

export const SCREEN_W = 256;
export const SCREEN_H = 240; // visarea (0,255,0,239); visible top row IS native row 0 (VISIBLE_Y0=0)
export const VISIBLE_Y0 = 0;

export const COLS = 32;
export const ROWS = 30; // visible tile rows (240/8)
export const TILE_W = 8;
export const TILE_H = 8;
export const SPRITE_W = 8;
export const SPRITE_H = 16;

// Real-ROM element counts for gfx1=4KB (0x800 per plane): 256 chars (8 bytes each), 128 sprites (16 each).
export const TILE_COUNT = 256;
export const SPRITE_COUNT = 128;

export const SPRITE_CLIP_RIGHT = 8; // spriteclip.max_x -= 8 (upright)

/** Decode 8x8 2bpp chars. Plane {RGN_FRAC(1,2)=MSB, 0=LSB} -> pen=(second<<1)|first. See FLAG [1]. */
export function decodeTiles(gfx1) {
  const half = gfx1.length >> 1;
  const count = (half / 8) | 0;
  const out = new Uint8Array(count * TILE_W * TILE_H);
  for (let code = 0; code < count; code++) {
    for (let y = 0; y < TILE_H; y++) {
      const lsbByte = code * 8 + y; // first half
      const msbByte = half + lsbByte; // second half
      for (let x = 0; x < TILE_W; x++) {
        const shift = 7 - x;
        const lsb = (gfx1[lsbByte] >> shift) & 1;
        const msb = (gfx1[msbByte] >> shift) & 1;
        out[code * 64 + y * TILE_W + x] = (msb << 1) | lsb;
      }
    }
  }
  return out;
}

/** Decode 8x16 2bpp sprites (spritelayout, centiped.cpp:1722). Same plane order as chars (FLAG [1]). */
export function decodeSprites(gfx1) {
  const half = gfx1.length >> 1;
  const count = (half / 16) | 0;
  const out = new Uint8Array(count * SPRITE_W * SPRITE_H);
  for (let code = 0; code < count; code++) {
    for (let y = 0; y < SPRITE_H; y++) {
      const lsbByte = code * 16 + y;
      const msbByte = half + lsbByte;
      for (let x = 0; x < SPRITE_W; x++) {
        const shift = 7 - x;
        const lsb = (gfx1[lsbByte] >> shift) & 1;
        const msb = (gfx1[msbByte] >> shift) & 1;
        out[code * (SPRITE_W * SPRITE_H) + y * SPRITE_W + x] = (msb << 1) | lsb;
      }
    }
  }
  return out;
}

/** gfx1 is ONE region used as BOTH tile and sprite source (different strides). No PROM: palette is built
 *  per-frame from paletteRam (see buildPalette), so this returns only decoded pixels. */
export function decodeGraphics(gfx1) {
  return { tiles: decodeTiles(gfx1), sprites: decodeSprites(gfx1) };
}

/** One palette-RAM byte -> [r,g,b]. All bits inverted; bit3 "alternate" dims blue (or green). (v.cpp:211) */
export function decodePaletteColor(data) {
  let r = 0xff * ((~data >> 0) & 1);
  let g = 0xff * ((~data >> 1) & 1);
  let b = 0xff * ((~data >> 2) & 1);
  if (~data & 0x08) {
    if (b) b = 0xc0;
    else if (g) g = 0xc0;
  }
  return [r, g, b];
}

/** Live palette from paletteRam (16 bytes). Only offsets with bit2 set are used by centiped_paletteram_w:
 *  char pens 0-3 <- ram[4..7]; sprite colour-slots 0-3 <- ram[12..15]. A sprite pixel's slot indexes here. */
export function buildPalette(paletteRam) {
  const charRGB = [
    decodePaletteColor(paletteRam[4]),
    decodePaletteColor(paletteRam[5]),
    decodePaletteColor(paletteRam[6]),
    decodePaletteColor(paletteRam[7]),
  ];
  const spriteSlotRGB = [
    decodePaletteColor(paletteRam[12]),
    decodePaletteColor(paletteRam[13]),
    decodePaletteColor(paletteRam[14]),
    decodePaletteColor(paletteRam[15]),
  ];
  return { charRGB, spriteSlotRGB };
}

function putPixel(out, o, rgb) {
  out[o] = rgb[0];
  out[o + 1] = rgb[1];
  out[o + 2] = rgb[2];
}

/** Paint output rows [y0,y1] inclusive: opaque tilemap, then sprites 0..15 (higher wins, penmask
 *  transparency). mem={videoRam,objRam,paletteRam}, gfx={tiles,sprites}. opts.flipScreen = LS259 q7. */
export function renderRowsRGB(out, y0, y1, mem, gfx, opts = {}) {
  const { flipScreen = false } = opts;
  const { videoRam, objRam, paletteRam } = mem;
  const { tiles, sprites } = gfx;
  const { charRGB, spriteSlotRGB } = buildPalette(paletteRam);

  const lo = y0 < 0 ? 0 : y0;
  const hi = y1 > SCREEN_H - 1 ? SCREEN_H - 1 : y1;
  const clipMin = flipScreen ? SPRITE_CLIP_RIGHT : 0;
  const clipMax = flipScreen ? SCREEN_W - 1 : SCREEN_W - 1 - SPRITE_CLIP_RIGHT;

  for (let row = lo; row <= hi; row++) {
    const rowBase = row * SCREEN_W * 3;
    const cellRow = row >> 3;
    const tileY = row & 7;

    // 1) Tilemap, OPAQUE (pen 0 included). TILEMAP_SCAN_ROWS -> index = cellRow*32 + col.
    for (let col = 0; col < COLS; col++) {
      const data = videoRam[cellRow * COLS + col];
      const code = (data & 0x3f) + 0x40;
      const flipx = data & 0x40;
      const flipy = data & 0x80;
      const srcY = flipy ? 7 - tileY : tileY;
      const srcRow = code * 64 + srcY * TILE_W;
      for (let px = 0; px < TILE_W; px++) {
        const pix = tiles[srcRow + (flipx ? TILE_W - 1 - px : px)];
        putPixel(out, rowBase + (col * TILE_W + px) * 3, charRGB[pix]);
      }
    }

    // 2) Sprites 0..15 (later overwrites earlier). Indirect colour: each 2-bit pen names a slot; slot 0
    //    transparent (== penmask). x=sram[o+0x20], y=240-sram[o+0x10].
    for (let o = 0; o < 16; o++) {
      const pic = objRam[o];
      const code = ((pic & 0x3e) >> 1) | ((pic & 1) << 6);
      const flipx = pic & 0x40;
      const flipy = pic & 0x80;
      const sx = objRam[o + 0x20];
      const sy = 240 - objRam[o + 0x10];
      const sprRow = row - sy;
      if (sprRow < 0 || sprRow >= SPRITE_H) continue;
      const srcY = flipy ? SPRITE_H - 1 - sprRow : sprRow;
      const src = code * (SPRITE_W * SPRITE_H) + srcY * SPRITE_W;
      const c = objRam[o + 0x30] & 0x3f;
      for (let i = 0; i < SPRITE_W; i++) {
        const xx = sx + i;
        if (xx < clipMin || xx > clipMax) continue;
        const pix = sprites[src + (flipx ? SPRITE_W - 1 - i : i)];
        if (pix === 0) continue; // pen 00 always transparent
        const slot = pix === 1 ? c & 3 : pix === 2 ? (c >> 2) & 3 : (c >> 4) & 3;
        if (slot === 0) continue; // penmask: a 0 colour-slot is transparent
        putPixel(out, rowBase + xx * 3, spriteSlotRGB[slot]);
      }
    }
  }
}

/** A whole frame into a fresh buffer -- a SNAPSHOT (equal to hardware only if nothing changed mid-frame).
 *  RGB888, row-major, top-left, UNROTATED. */
export function renderFrameRGB(mem, gfx, opts = {}) {
  const out = new Uint8Array(SCREEN_W * SCREEN_H * 3);
  renderRowsRGB(out, 0, SCREEN_H - 1, mem, gfx, opts);
  return out;
}
