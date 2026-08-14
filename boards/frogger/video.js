// SPDX-License-Identifier: GPL-3.0-only
/**
 * Frogger video renderer, from MAME galaxian_v.cpp (Galaxian/Scramble family). NOT a fork of konami/:
 * OBJRAM interleaves per-column scroll/color with the sprite + bullet blocks in ONE region, colors are
 * remapped by a 3-bit rotate, and the background is a fixed blue/black split (no starfield, no per-region
 * PROM lookup). Draw order (screen_update_galaxian@460): background -> tilemap -> sprites -> bullets.
 *
 * ★ FIVE THINGS THAT ARE NEW vs pooyan/timeplt (each a place a plausible-but-wrong bug hides):
 *  1. 2bpp (pens 0..3); planes = the two halves of gfx1 {RGN_FRAC(0,2)=MSB, RGN_FRAC(1,2)=LSB} (galaxian.cpp:7391).
 *  2. OBJRAM 0x00-0x3F: even byte = per-column scroll-Y (Frogger NIBBLE-SWAP (v>>4)|(v<<4) first), odd = color base (@528).
 *  3. Color = frogger_extend 3-bit ROTATE-RIGHT ((c>>1)&3)|((c<<2)&4) for tiles AND sprites; ONE 32-pen palette, pen=color*4+pixel (@1275).
 *  4. Sprites: 8 at OBJRAM 0x40-0x5F, drawn 7->0 (low wins); base0=nibbleSwap(objram[base]); sy=240-(base0-(sprnum<3?1:0)); sx=objram[base+3]+1; 16px hard-clip at native x<17 (@554-618).
 *  5. Background = horizontal split: native x<128 blue rgb(0,0,0x47), x>=128 black (frogger_draw_background@1076).
 *
 * ★ Palette resnet normalizes to RGB_MAXIMUM=224 (@229, NOT 255) with PULLDOWN 470 (not pooyan's 1000):
 *   RG={1000,470,220}, B={470,220}. All-on R/G top out at 224, 2-bit blue dimmer (217). 255 or 1000 = wrong.
 * Raster: native 256x224, VISIBLE_Y0=16 (galaxian VBEND); ROT90 rendered UNROTATED (the display layer rotates).
 * ⚠️ FLIPSCREEN (cocktail P2): UPRIGHT is the validated path; flip x NONZERO-scroll interaction is NOT
 *   separately validated (needs a MAME pixel-diff). In normal play the tilemap scroll is ~0, so it's exact.
 */

export const SCREEN_W = 256;
export const SCREEN_H = 224;

/** set_raw visarea -> native row 16 is output row 0 (galaxian VBEND=16). */
export const VISIBLE_Y0 = 16;

export const COLS = 32;
export const ROWS = 32;
export const TILE_W = 8;
export const TILE_H = 8;
export const SPRITE_W = 16;
export const SPRITE_H = 16;

/** 2bpp -> 4 pens per cell. */
export const PENS_PER_CELL = 4;

/** Real-ROM element counts (gfx1=0x1000, two 0x800 halves): 256 tiles, 64 sprites. decode* derive the
 * count from ROM length (a synthetic test can feed a smaller image); these are the real values. */
export const TILE_COUNT = 256;
export const SPRITE_COUNT = 64;

/** 8 color sets x 4 pens = 32 (PALETTE(32), galaxian.cpp:7496; PROM is 0x20 bytes). */
export const PALETTE_SIZE = 32;

export const RGB_MAXIMUM = 224; // resnet ceiling, galaxian_v.cpp:229 (NOT 255); see header

/** Fixed Frogger background colors (galaxian_v.cpp:1079). */
export const BACKGROUND_BLUE = [0, 0, 0x47];
export const BACKGROUND_BLACK = [0, 0, 0];
export const BACKGROUND_SPLIT_X = 128;

/** Sprite line-buffer hard clip: native x < 17 is dropped (sprites_clip, galaxian_v.cpp:554-565). */
export const SPRITE_CLIP_LEFT = 17;

// OBJRAM block bases (galaxian.h:428-429): sprites 0x40-0x5F, bullets 0x60-0x7F (4 bytes each).
export const SPRITE_BASE = 0x40;
export const BULLET_BASE = 0x60;

/** Frogger's OBJRAM-adder nibble swap: top and bottom 4 bits exchanged (galaxian_v.cpp:528,581). */
export function froggerNibbleSwap(v) {
  return ((v >> 4) | (v << 4)) & 0xff;
}

/** frogger_extend_{tile,sprite}_info (galaxian_v.cpp:1275): 3-bit ROTATE-RIGHT ((c>>1)&3)|((c<<2)&4), maps 0..7 -> 0,4,1,5,2,6,3,7. */
export function froggerExtendColor(c) {
  return ((c >> 1) & 0x03) | ((c << 2) & 0x04);
}

/** Decode the tile ROM (galaxian_charlayout, galaxian.cpp:7391): 8x8 2bpp, planes = the two ROM halves
 * (first=MSB, second=LSB), byte=code*8+y, pixel bit (7-x). Returns count*64 pen indices (0..3). */
export function decodeTiles(rom) {
  const half = rom.length >> 1;
  const count = (half / 8) | 0;
  const out = new Uint8Array(count * TILE_W * TILE_H);
  for (let code = 0; code < count; code++) {
    for (let y = 0; y < TILE_H; y++) {
      const loByte = code * 8 + y;
      const hiByte = half + loByte;
      for (let x = 0; x < TILE_W; x++) {
        const shift = 7 - x;
        const b0 = (rom[loByte] >> shift) & 1; // first half  -> MSB
        const b1 = (rom[hiByte] >> shift) & 1; // second half -> LSB
        out[code * 64 + y * TILE_W + x] = (b0 << 1) | b1;
      }
    }
  }
  return out;
}

/** Decode the sprite ROM (galaxian_spritelayout, galaxian.cpp:7402): 16x16 2bpp, planes = the two ROM
 * halves (first=MSB); byte=code*32+(y<8?y:y+8)+(x<8?0:8), bit (7-(x&7)). Returns count*256 pens (0..3). */
export function decodeSprites(rom) {
  const half = rom.length >> 1;
  const count = (half / 32) | 0;
  const out = new Uint8Array(count * SPRITE_W * SPRITE_H);
  for (let code = 0; code < count; code++) {
    for (let y = 0; y < SPRITE_H; y++) {
      const yByte = y < 8 ? y : y + 8;
      for (let x = 0; x < SPRITE_W; x++) {
        const shift = 7 - (x & 7);
        const loByte = code * 32 + yByte + (x < 8 ? 0 : 8);
        const hiByte = half + loByte;
        const b0 = (rom[loByte] >> shift) & 1;
        const b1 = (rom[hiByte] >> shift) & 1;
        out[code * 256 + y * SPRITE_W + x] = (b0 << 1) | b1;
      }
    }
  }
  return out;
}

/** MAME compute_resistor_weights (video/resnet) as galaxian_palette calls it (galaxian_v.cpp:274): minval 0,
 * maxval RGB_MAXIMUM, auto-scale, PULLDOWN 470. One shared scale maps the largest all-on net to maxval (so
 * 2-bit blue is dimmer). Same model as pooyan/video.js, different constants (224/470 vs 255/1000). */
function computeResistorWeights(minval, maxval, scaler, nets) {
  const VCC = 5.0;
  const per = nets.map((net) => {
    const gpd = net.pulldown ? 1 / net.pulldown : 0;
    const gpu = net.pullup ? 1 / net.pullup : 0;
    const gi = net.resistances.map((r) => 1 / r);
    const gtot = gi.reduce((a, b) => a + b, 0) + gpd + gpu;
    const w = gi.map((g) => (VCC * g) / gtot);
    const offset = (VCC * gpu) / gtot;
    return { w, offset, maxOut: offset + w.reduce((a, b) => a + b, 0) };
  });
  const scale = scaler < 0 ? (maxval - minval) / Math.max(...per.map((p) => p.maxOut)) : scaler;
  return per.map((p) => ({
    offset: minval + p.offset * scale,
    weights: p.w.map((x) => x * scale),
  }));
}

const RESNET = computeResistorWeights(0, RGB_MAXIMUM, -1.0, [
  { resistances: [1000, 470, 220], pulldown: 470, pullup: 0 }, // red (green net identical)
  { resistances: [1000, 470, 220], pulldown: 470, pullup: 0 },
  { resistances: [470, 220], pulldown: 470, pullup: 0 }, // blue (2 bits)
]);

/** Weighted DAC coefficients (bit0 = weakest resistor first); values verified in video.test.js. */
export const RWEIGHTS = RESNET[0].weights;
export const GWEIGHTS = RESNET[1].weights;
export const BWEIGHTS = RESNET[2].weights;

/** The 32 base colours from the 32-byte PROM: r=bits 0-2, g=bits 3-5, b=bits 6-7 (galaxian_v.cpp:281);
 * combine_weights rounds (int)(sum+0.5). Returns 32 RGB triples. */
export function baseColours(proms) {
  const bit = (v, n) => (v >> n) & 1;
  const comb = (w, bits) => {
    let s = 0;
    for (let k = 0; k < w.length; k++) s += w[k] * bits[k];
    return Math.floor(s + 0.5);
  };
  const out = [];
  for (let i = 0; i < PALETTE_SIZE; i++) {
    const p = proms[i];
    const r = comb(RWEIGHTS, [bit(p, 0), bit(p, 1), bit(p, 2)]);
    const g = comb(GWEIGHTS, [bit(p, 3), bit(p, 4), bit(p, 5)]);
    const b = comb(BWEIGHTS, [bit(p, 6), bit(p, 7)]);
    out.push([r, g, b]);
  }
  return out;
}

/** The palette as flat RGB (pen*3+channel), 32 pens. NO char/sprite LUT (unlike pooyan): pen i maps
 * directly through PROM byte i's resnet; tiles and sprites both index pen=color*4+pixel. */
export function buildPalette(proms) {
  if (proms.length < PALETTE_SIZE) {
    throw new Error(`proms must be at least ${PALETTE_SIZE} bytes, got ${proms.length}`);
  }
  const base = baseColours(proms);
  const out = new Uint8Array(PALETTE_SIZE * 3);
  for (let i = 0; i < PALETTE_SIZE; i++) {
    out[i * 3] = base[i][0];
    out[i * 3 + 1] = base[i][1];
    out[i * 3 + 2] = base[i][2];
  }
  return out;
}

export function decodeGraphics(tilesRom, spritesRom, proms) {
  return {
    tiles: decodeTiles(tilesRom),
    sprites: decodeSprites(spritesRom),
    palette: buildPalette(proms),
  };
}

/** Resolve one sprite's geometry from OBJRAM (sprites_draw, galaxian_v.cpp:568-618), sprnum 0..7:
 *   base0=nibbleSwap(objram[base]); sy=240-(base0-(sprnum<3?1:0)); code=objram[base+1]&0x3f;
 *   flipx=base+1&0x40; flipy=base+1&0x80; color=extend(objram[base+2]&7); sx=objram[base+3]+1.
 * Flipscreen (after): sx=240-sx, !flipx; sy=240-sy, !flipy. */
export function spriteAttrs(objram, sprnum, opts = {}) {
  const { flipScreenX = false, flipScreenY = false } = opts;
  const base = SPRITE_BASE + sprnum * 4;
  const base0 = froggerNibbleSwap(objram[base]);
  let sy = (240 - (base0 - (sprnum < 3 ? 1 : 0))) & 0xff;
  const code = objram[base + 1] & 0x3f;
  let flipx = (objram[base + 1] & 0x40) !== 0;
  let flipy = (objram[base + 1] & 0x80) !== 0;
  const color = froggerExtendColor(objram[base + 2] & 7);
  let sx = (objram[base + 3] + 1) & 0xff;
  if (flipScreenX) { sx = (240 - sx) & 0xff; flipx = !flipx; }
  if (flipScreenY) { sy = (240 - sy) & 0xff; flipy = !flipy; }
  return { sx, sy, code, color, flipx, flipy };
}

function putPixel(out, o, palette, pen) {
  const p = pen * 3;
  out[o] = palette[p];
  out[o + 1] = palette[p + 1];
  out[o + 2] = palette[p + 2];
}

/** Paint output rows [y0,y1] inclusive into `out` in place: background, tilemap (transparent pen 0),
 * sprites (7->0, low wins, transparent pen 0), bullets. mem={videoRam,objRam}, gfx={tiles,sprites,palette}. */
export function renderRowsRGB(out, y0, y1, mem, gfx, opts = {}) {
  const { flipScreenX = false, flipScreenY = false } = opts;
  const { videoRam, objRam } = mem;
  const { tiles, sprites, palette } = gfx;

  const lo = y0 < 0 ? 0 : y0;
  const hi = y1 > SCREEN_H - 1 ? SCREEN_H - 1 : y1;

  for (let row = lo; row <= hi; row++) {
    const nativeY = row + VISIBLE_Y0;
    const rowBase = row * SCREEN_W * 3;

    // 1) Background: horizontal blue/black split (mirrored under flipScreenX).
    for (let x = 0; x < SCREEN_W; x++) {
      const blue = flipScreenX ? x >= BACKGROUND_SPLIT_X : x < BACKGROUND_SPLIT_X;
      const c = blue ? BACKGROUND_BLUE : BACKGROUND_BLACK;
      const o = rowBase + x * 3;
      out[o] = c[0];
      out[o + 1] = c[1];
      out[o + 2] = c[2];
    }

    // 2) Tilemap over background, transparent pen 0. Per-column scroll-Y + color base.
    for (let cx = 0; cx < COLS; cx++) {
      const col = flipScreenX ? COLS - 1 - cx : cx;
      const scrollY = froggerNibbleSwap(objRam[col * 2]);
      const color = froggerExtendColor(objRam[col * 2 + 1] & 7);
      const sourceY = (nativeY - scrollY) & 0xff; // tilemap set_scrolly sign (tilemap.cpp:1128)
      const cellY = flipScreenY ? ROWS - 1 - (sourceY >> 3) : sourceY >> 3;
      const tileY = flipScreenY ? 7 - (sourceY & 7) : sourceY & 7;
      const code = videoRam[cellY * COLS + col];
      const srcRow = code * 64 + tileY * TILE_W;
      const penBase = color * PENS_PER_CELL;
      for (let px = 0; px < TILE_W; px++) {
        const pix = tiles[srcRow + (flipScreenX ? TILE_W - 1 - px : px)];
        if (pix === 0) continue; // transparent -> background shows through
        putPixel(out, rowBase + (cx * TILE_W + px) * 3, palette, penBase + pix);
      }
    }

    for (let sprnum = 7; sprnum >= 0; sprnum--) {
      const a = spriteAttrs(objRam, sprnum, { flipScreenX, flipScreenY });
      const sprRow = nativeY - a.sy;
      if (sprRow < 0 || sprRow >= SPRITE_H) continue;
      const srcRow = a.flipy ? SPRITE_H - 1 - sprRow : sprRow;
      const src = a.code * 256 + srcRow * SPRITE_W;
      const penBase = a.color * PENS_PER_CELL;
      for (let i = 0; i < SPRITE_W; i++) {
        const x = (a.sx + i) & 0xff;
        if (!flipScreenX && x < SPRITE_CLIP_LEFT) continue; // line-buffer clip (SPRITE_CLIP_LEFT); flipped drops x>238
        if (flipScreenX && x > SCREEN_W - SPRITE_CLIP_LEFT - 1) continue;
        if (x >= SCREEN_W) continue;
        const pix = sprites[src + (a.flipx ? SPRITE_W - 1 - i : i)];
        if (pix === 0) continue;
        putPixel(out, rowBase + x * 3, palette, penBase + pix);
      }
    }

    // 4) Bullets (galaxian_draw_bullet 4px streak, @629-660). Frogger likely never fills 0x60-0x7F, so inert.
    drawBulletsRow(out, rowBase, nativeY, objRam, flipScreenY);
  }
}

/** One scanline of the bullet layer. white for shells 0-6, yellow for the missile (7). */
function drawBulletsRow(out, rowBase, y, objRam, flipScreenY) {
  let shell = 0xff;
  let missile = 0xff;
  let effy = (flipScreenY ? (y - 1) ^ 255 : y - 1) & 0xff;
  for (let which = 0; which < 3; which++) {
    if (((objRam[BULLET_BASE + which * 4 + 1] + effy) & 0xff) === 0xff) shell = which;
  }
  effy = (flipScreenY ? y ^ 255 : y) & 0xff;
  for (let which = 3; which < 8; which++) {
    if (((objRam[BULLET_BASE + which * 4 + 1] + effy) & 0xff) === 0xff) {
      if (which !== 7) shell = which;
      else missile = which;
    }
  }
  const streak = (which, rgb) => {
    let x = (255 - objRam[BULLET_BASE + which * 4 + 3]) & 0xff;
    x -= 4;
    for (let k = 0; k < 4; k++) {
      const xx = x + k;
      if (xx >= 0 && xx < SCREEN_W) {
        const o = rowBase + xx * 3;
        out[o] = rgb[0]; out[o + 1] = rgb[1]; out[o + 2] = rgb[2];
      }
    }
  };
  if (shell !== 0xff) streak(shell, [0xff, 0xff, 0xff]);
  if (missile !== 0xff) streak(missile, [0xff, 0xff, 0x00]);
}

/** A whole frame into a fresh buffer -- a SNAPSHOT, equal to hardware only if nothing mid-frame changed.
 * Returns RGB888, row-major, top-left, UNROTATED. */
export function renderFrameRGB(mem, gfx, opts = {}) {
  const out = new Uint8Array(SCREEN_W * SCREEN_H * 3);
  renderRowsRGB(out, 0, SCREEN_H - 1, mem, gfx, opts);
  return out;
}
