// SPDX-License-Identifier: GPL-3.0-only
/**
 * Pooyan video renderer (konami/pooyan.cpp), forked from boards/timeplt/video.js. Deltas vs timeplt,
 * each a place a plausible-but-wrong bug hides: (1) 4bpp not 2bpp -- gfx planes {RGN_FRAC(1,2)+4, +0,
 * 4, 0}, low pen bits from ROM half 1 (timeplt's decode), high from half 2; (2) SINGLE-LAYER (tilemap
 * opaque then sprites, no priority split); (3) sprites ASCENDING (offs 0x10->0x3E) so the HIGHEST
 * offset wins overlap; (4) palette 32x8 base + two 256x4 luts, r=bits0-2 g=bits3-5 b=bits6-7, char
 * pens base[0x10..0x1f]/sprite base[0x00..0x0f]. Raster x 0..255 y 16..239, native/unrotated, always
 * on. (pooyan.cpp:105-159,379-399,440)
 */

export const SCREEN_W = 256;
export const SCREEN_H = 224;

export const NATIVE_H = 256;

export const VISIBLE_Y0 = 16; // set_raw visarea y 16..239: output row 0 = native row 16

export const COLS = 32;
export const ROWS = 32;
export const TILE_W = 8;
export const TILE_H = 8;
export const SPRITE_W = 16;
export const SPRITE_H = 16;

export const PENS_PER_CELL = 16;

// RGN_FRAC(1,2): bits split across two ROM halves. Tiles 8KB @16 bytes/half -> 256; sprites 8KB
// @64 bytes/half -> 64. decode* derive these from ROM length (a test can feed a smaller image);
// these are the real-ROM values.
export const TILE_COUNT = 256;
export const SPRITE_COUNT = 64;

export const CHAR_PENS = 16 * PENS_PER_CELL;
export const SPRITE_PEN_BASE = 16 * PENS_PER_CELL; // char pens 0..255, then sprite pens 256..511
export const PALETTE_SIZE = 16 * PENS_PER_CELL + 16 * PENS_PER_CELL; // 512

/** PROM region layout (pooyan.cpp:459-482): pr1 base (32) + pr3 char lut (256) + pr2 sprite lut (256). */
export const PROM_SIZE = 32 + 256 + 256; // 544

/**
 * Tile ROM -> 4-bit indices, 64/tile. Two halves (8.10g then 7.9g), HALF = rom.length/2. For (x,y) of
 * `code`: byteLo = code*16 + (x<4?0:8) + y, byteHi = HALF+byteLo. pen bits 0,1 = hi,lo nibble of byteLo
 * (timeplt's two pens); 2,3 = hi,lo nibble of byteHi. shift = 3-(x&3), col 0 MSB; plane[3]=0 LSB.
 */
export function decodeTiles(rom) {
  const half = rom.length >> 1;
  const count = (half / 16) | 0;
  const out = new Uint8Array(count * TILE_W * TILE_H);
  for (let code = 0; code < count; code++) {
    for (let y = 0; y < TILE_H; y++) {
      for (let x = 0; x < TILE_W; x++) {
        const shift = 3 - (x & 3);
        const byteLo = code * 16 + (x < 4 ? 0 : 8) + y;
        const byteHi = half + byteLo;
        const b0 = (rom[byteLo] >> (shift + 4)) & 1;
        const b1 = (rom[byteLo] >> shift) & 1;
        const b2 = (rom[byteHi] >> (shift + 4)) & 1;
        const b3 = (rom[byteHi] >> shift) & 1;
        out[code * 64 + y * TILE_W + x] = b0 | (b1 << 1) | (b2 << 2) | (b3 << 3);
      }
    }
  }
  return out;
}

/**
 * Sprite ROM -> 256 px/sprite. Two-half 4bpp packing as tiles; 16x16 spritelayout (pooyan.cpp:390-399):
 * first-half byte for (x,y) = code*64 + (x>>2)*8 + (y<8 ? y : y+24) (timeplt's); half 2 adds bits 2,3.
 */
export function decodeSprites(rom) {
  const half = rom.length >> 1;
  const count = (half / 64) | 0;
  const out = new Uint8Array(count * SPRITE_W * SPRITE_H);
  for (let code = 0; code < count; code++) {
    for (let y = 0; y < SPRITE_H; y++) {
      const yByte = y < 8 ? y : y + 24;
      for (let x = 0; x < SPRITE_W; x++) {
        const shift = 3 - (x & 3);
        const byteLo = code * 64 + (x >> 2) * 8 + yByte;
        const byteHi = half + byteLo;
        const b0 = (rom[byteLo] >> (shift + 4)) & 1;
        const b1 = (rom[byteLo] >> shift) & 1;
        const b2 = (rom[byteHi] >> (shift + 4)) & 1;
        const b3 = (rom[byteHi] >> shift) & 1;
        out[code * 256 + y * SPRITE_W + x] = b0 | (b1 << 1) | (b2 << 2) | (b3 << 3);
      }
    }
  }
  return out;
}

/** pr1 base / pr3 char lut / pr2 sprite lut; the ORDER (pooyan.cpp:478-481) is the interface. */
export function splitProms(proms) {
  if (proms.length !== PROM_SIZE) {
    throw new Error(`proms must be ${PROM_SIZE} bytes (pr1+pr3+pr2), got ${proms.length}`);
  }
  return {
    base: proms.subarray(0, 32),
    charLut: proms.subarray(32, 288),
    spriteLut: proms.subarray(288, 544),
  };
}

/**
 * MAME compute_resistor_weights for this board (pooyan.cpp:113): minval 0 maxval 255, auto-scale,
 * pulldown 1000, pullup 0. Weight_i = Vcc*(1/R_i)/Gtot, Gtot = sum(1/R_i)+1/pulldown; ONE shared scale
 * (blue's 2 bits dimmer than r/g's 3). ★ MODEL from resistances, not measured -- CONFIRM vs MAME.
 */
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

const RESNET = computeResistorWeights(0, 255, -1.0, [
  { resistances: [1000, 470, 220], pulldown: 1000, pullup: 0 }, // red
  { resistances: [1000, 470, 220], pulldown: 1000, pullup: 0 }, // green (identical net)
  { resistances: [470, 220], pulldown: 1000, pullup: 0 }, // blue
]);

export const RWEIGHTS = RESNET[0].weights; // per-channel DAC coeffs, bit0 = weakest resistor; for the test
export const GWEIGHTS = RESNET[1].weights;
export const BWEIGHTS = RESNET[2].weights;

/** 32 base colours: r=prom bits 0,1,2 · g=bits 3,4,5 · b=bits 6,7. Rounds to nearest (sum+0.5). */
export function baseColours(proms) {
  const bit = (v, n) => (v >> n) & 1;
  const comb = (w, bits) => {
    let s = 0;
    for (let k = 0; k < w.length; k++) s += w[k] * bits[k];
    return Math.floor(s + 0.5);
  };
  const out = [];
  for (let i = 0; i < 32; i++) {
    const p = proms[i];
    const r = comb(RWEIGHTS, [bit(p, 0), bit(p, 1), bit(p, 2)]);
    const g = comb(GWEIGHTS, [bit(p, 3), bit(p, 4), bit(p, 5)]);
    const b = comb(BWEIGHTS, [bit(p, 6), bit(p, 7)]);
    out.push([r, g, b]);
  }
  return out;
}

/** Palette, flat RGB (pen*3+channel), 512 pens: char pens index base[(pr3[i]&0x0f)|0x10], sprite pens
 *  base[pr2[i]&0x0f] (pooyan.cpp:147-158). */
export function buildPalette(proms) {
  const base = baseColours(proms);
  const { charLut, spriteLut } = splitProms(proms);
  const out = new Uint8Array(PALETTE_SIZE * 3);
  for (let i = 0; i < 256; i++) {
    const c = base[(charLut[i] & 0x0f) | 0x10];
    const p = i * 3;
    out[p] = c[0];
    out[p + 1] = c[1];
    out[p + 2] = c[2];
  }
  for (let i = 0; i < 256; i++) {
    const c = base[spriteLut[i] & 0x0f];
    const p = (SPRITE_PEN_BASE + i) * 3;
    out[p] = c[0];
    out[p + 1] = c[1];
    out[p + 2] = c[2];
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

/**
 * Sprite RAM: two banks, halves of each sprite at the SAME offset (pooyan.cpp:225-231). sprite0[offs]=x,
 * [offs+1]=code; sprite1[offs]=colour bits0-3 + flipx bit6 (ACTIVE LOW) + flipy bit7; [offs+1]=240-y.
 */
export const SPRITE_OFFS_FIRST = 0x10;
export const SPRITE_OFFS_LAST = 0x3e;

/** Paint output rows [y0,y1] inclusive into `out`. Single layer: tilemap opaque, then sprites over
 *  it; no video-enable, so every row is drawn. opts = { flipScreen }. */
export function renderRowsRGB(out, y0, y1, mem, gfx, opts = {}) {
  const { flipScreen = false } = opts;

  const { colorRam, videoRam, sprite0, sprite1 } = mem;
  const { tiles, sprites, palette } = gfx;

  const lo = y0 < 0 ? 0 : y0;
  const hi = y1 > SCREEN_H - 1 ? SCREEN_H - 1 : y1;

  for (let row = lo; row <= hi; row++) {
    const ny = row + VISIBLE_Y0;
    const rowBase = row * SCREEN_W * 3;

    // Flip = a CELL mirror plus a per-tile flag XOR = a plain native mirror. Scroll is 0, no offset.
    const cellRow = (flipScreen ? ROWS - 1 - (ny >> 3) : ny >> 3) * COLS;
    const tileY = ny & 7;

    for (let cx = 0; cx < COLS; cx++) {
      const cell = cellRow + (flipScreen ? COLS - 1 - cx : cx);
      paintTileRow(out, rowBase, cx, cell, colorRam[cell], tileY, videoRam, tiles, palette, flipScreen);
    }

    // Pass 2: sprites (transparent pen 0), scanned UPWARD so the HIGHEST offset wins overlap.
    for (let offs = SPRITE_OFFS_FIRST; offs <= SPRITE_OFFS_LAST; offs += 2) {
      const sy = 240 - sprite1[offs + 1];
      const sprRow = ny - sy;
      if (sprRow < 0 || sprRow >= SPRITE_H) continue;

      const sx = sprite0[offs];
      const code = sprite0[offs + 1] % SPRITE_COUNT;
      const ctrl = sprite1[offs];
      const color = ctrl & 0x0f;
      const flipx = (~ctrl & 0x40) !== 0;
      const flipy = (ctrl & 0x80) !== 0;

      const srcRow = flipy ? SPRITE_H - 1 - sprRow : sprRow;
      const src = code * 256 + srcRow * SPRITE_W;
      const penBase = SPRITE_PEN_BASE + color * PENS_PER_CELL;

      for (let i = 0; i < SPRITE_W; i++) {
        const x = sx + i;
        if (x >= SCREEN_W) break; // MAME clips to the cliprect; it does NOT wrap
        const pix = sprites[src + (flipx ? SPRITE_W - 1 - i : i)];
        if (pix === 0) continue;
        const pen = (penBase + pix) * 3;
        const o = rowBase + x * 3;
        out[o] = palette[pen];
        out[o + 1] = palette[pen + 1];
        out[o + 2] = palette[pen + 2];
      }
    }
  }
}

/**
 * Paint one tile cell's 8 pixels on one row, OPAQUELY (pen 0 included). code = videoram[cell] (WHOLE
 * byte, no bank bit); color = attr&0x0f; flip = TILE_FLIPYX(attr>>6) = identity `yx&3` (TILE_FLIPX is
 * 0x01, so attr bit 6 is X). Char pens start at 0, so penBase = color*16. (pooyan.cpp:172-174)
 */
function paintTileRow(out, rowBase, cx, cell, attr, tileY, videoRam, tiles, palette, flipScreen) {
  const code = videoRam[cell];
  const penBase = (attr & 0x0f) * PENS_PER_CELL;
  const flipX = ((attr & 0x40) !== 0) !== flipScreen;
  const flipY = ((attr & 0x80) !== 0) !== flipScreen;
  const src = code * 64 + (flipY ? TILE_H - 1 - tileY : tileY) * TILE_W;
  let o = rowBase + cx * 8 * 3;
  for (let i = 0; i < TILE_W; i++) {
    const pen = (penBase + tiles[src + (flipX ? TILE_W - 1 - i : i)]) * 3;
    out[o] = palette[pen];
    out[o + 1] = palette[pen + 1];
    out[o + 2] = palette[pen + 2];
    o += 3;
  }
}

/** A whole frame into a fresh buffer (RGB888, row-major, top-left, UNROTATED); a snapshot. */
export function renderFrameRGB(mem, gfx, opts = {}) {
  const out = new Uint8Array(SCREEN_W * SCREEN_H * 3);
  renderRowsRGB(out, 0, SCREEN_H - 1, mem, gfx, opts);
  return out;
}
