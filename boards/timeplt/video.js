// SPDX-License-Identifier: GPL-3.0-only
/**
 * Time Pilot video renderer, from MAME konami/timeplt.cpp.
 *
 * Three layers (screen_update): category-0 tiles, sprites with pen 0 transparent, then
 * category-1 tiles OVER them. Category is per CELL (attr bit 4), the board's only
 * priority mechanism. The tilemap is OPAQUE, pen 0 included -- treating pen 0 as
 * transparent looks right on a black background and is not.
 *
 * Raster 256x256, visible y 16..239, sprites in native space, rendered unrotated.
 * VIDEO_UPDATE_SCANLINE, so a mid-frame VRAM write shows below the beam, not above.
 */

export const SCREEN_W = 256;
export const SCREEN_H = 224;

/** Raster height. Documentation only -- NOTHING READS IT. */
export const NATIVE_H = 256;

/** set_visarea -> y 16..239, so output row 0 is native row 16. */
export const VISIBLE_Y0 = 16;

export const COLS = 32;
export const ROWS = 32;
export const TILE_W = 8;
export const TILE_H = 8;
export const SPRITE_W = 16;
export const SPRITE_H = 16;

/** Tile region / 16 bytes per tile; code = vram + 8*(attr&0x20). */
export const TILE_COUNT = 512;

/** 16384-byte sprite region / 64 bytes per sprite. code is a whole byte, so all 256. */
export const SPRITE_COUNT = 256;

/** Char pens precede sprite pens, so one's count IS the other's base. CHAR_PENS is unread. */
export const CHAR_PENS = 32 * 4;
export const SPRITE_PEN_BASE = 32 * 4;
export const PALETTE_SIZE = 32 * 4 + 64 * 4;

/** PROM region layout: b4 (32) + b5 (32) + e9 (256) + e12 (256) = 576 bytes. */
export const PROM_SIZE = 576;

/**
 * Decode the tile ROM to 2-bit pixel indices, 64 per tile. `charlayout` makes a tile
 * TWO 8-byte column halves, not eight 2-byte rows: the byte for (x,y) is
 * tile*16 + (x < 4 ? 0 : 8) + y, high nibble pen bit 0, low nibble pen bit 1, column 0
 * most significant. Swapping the planes swaps pens 1 and 2 -- a plausible wrong image.
 */
export function decodeTiles(rom) {
  const out = new Uint8Array(TILE_COUNT * TILE_W * TILE_H);
  for (let code = 0; code < TILE_COUNT; code++) {
    for (let y = 0; y < TILE_H; y++) {
      for (let x = 0; x < TILE_W; x++) {
        const byte = rom[code * 16 + (x < 4 ? 0 : 8) + y];
        const shift = 3 - (x & 3);
        const lo = (byte >> (shift + 4)) & 1;
        const hi = (byte >> shift) & 1;
        out[code * 64 + y * TILE_W + x] = lo | (hi << 1);
      }
    }
  }
  return out;
}

/**
 * Decode the sprite ROM, 256 pixels per sprite. Same nibble-pair packing as the tiles
 * extended both ways: byte = sprite*64 + (x>>2)*8 + (y < 8 ? y : y + 24).
 */
export function decodeSprites(rom) {
  const out = new Uint8Array(SPRITE_COUNT * SPRITE_W * SPRITE_H);
  for (let code = 0; code < SPRITE_COUNT; code++) {
    for (let y = 0; y < SPRITE_H; y++) {
      const yByte = y < 8 ? y : y + 24;
      for (let x = 0; x < SPRITE_W; x++) {
        const byte = rom[code * 64 + (x >> 2) * 8 + yByte];
        const shift = 3 - (x & 3);
        const lo = (byte >> (shift + 4)) & 1;
        const hi = (byte >> shift) & 1;
        out[code * 256 + y * SPRITE_W + x] = lo | (hi << 1);
      }
    }
  }
  return out;
}

/** b4/b5 are the colour table, e9/e12 the lookups; the ORDER is the interface. */
export function splitProms(proms) {
  if (proms.length !== PROM_SIZE) {
    throw new Error(`proms must be ${PROM_SIZE} bytes (b4+b5+e9+e12), got ${proms.length}`);
  }
  return {
    b4: proms.subarray(0, 32),
    b5: proms.subarray(32, 64),
    e9: proms.subarray(64, 320),
    e12: proms.subarray(320, 576),
  };
}

/** 5-bit weighted DAC, summing to 0xFF. Written as literals, not through resnet.cpp:
 *  no monitor model, no diode drop, no normalize_range. */
export const DAC_WEIGHTS = [0x19, 0x24, 0x35, 0x40, 0x4d];

/**
 * The 32 base colours. GREEN STRADDLES BOTH PROMS; b5 bit 0 is not connected.
 *   r = b5 bits 1..5    g = b5 bits 6,7 + b4 bits 0,1,2    b = b4 bits 3..7
 * @returns {Array<[number,number,number]>} 32 RGB triples
 */
export function baseColours(proms) {
  const { b4, b5 } = splitProms(proms);
  const w = DAC_WEIGHTS;
  const bit = (v, n) => (v >> n) & 1;
  const out = [];
  for (let i = 0; i < 32; i++) {
    let r = 0;
    for (let k = 0; k < 5; k++) r += w[k] * bit(b5[i], 1 + k);
    const gbits = [bit(b5[i], 6), bit(b5[i], 7), bit(b4[i], 0), bit(b4[i], 1), bit(b4[i], 2)];
    let g = 0;
    for (let k = 0; k < 5; k++) g += w[k] * gbits[k];
    let b = 0;
    for (let k = 0; k < 5; k++) b += w[k] * bit(b4[i], 3 + k);
    out.push([r, g, b]);
  }
  return out;
}

/**
 * The palette, flat RGB (pen*3 + channel). Two lookups over DISJOINT HALVES of the
 * base colours -- the `+ 0x10` is why one nibble means different colours per layer:
 *   sprites  pen 32*4 + i = base[e9[i] & 0x0f]    chars  pen i = base[(e12[i]&0x0f)+0x10]
 * Only the first half of e12 is read; the rest is unused, not an error.
 * @returns {Uint8Array} PALETTE_SIZE * 3 bytes
 */
export function buildPalette(proms) {
  const base = baseColours(proms);
  const { e9, e12 } = splitProms(proms);
  const out = new Uint8Array(PALETTE_SIZE * 3);
  for (let i = 0; i < 64 * 4; i++) {
    const c = base[e9[i] & 0x0f];
    const p = (SPRITE_PEN_BASE + i) * 3;
    out[p] = c[0];
    out[p + 1] = c[1];
    out[p + 2] = c[2];
  }
  for (let i = 0; i < 32 * 4; i++) {
    const c = base[(e12[i] & 0x0f) + 0x10];
    out[i * 3] = c[0];
    out[i * 3 + 1] = c[1];
    out[i * 3 + 2] = c[2];
  }
  return out;
}

/** One-shot decode of the video ROMs. Immutable, so a Machine does it once. */
export function decodeGraphics(tilesRom, spritesRom, proms) {
  return {
    tiles: decodeTiles(tilesRom),
    sprites: decodeSprites(spritesRom),
    palette: buildPalette(proms),
  };
}

/**
 * Sprite RAM: TWO BANKS holding different halves of each sprite at the SAME offset.
 *   bank0[offs] x (no wrap)   bank0[offs+1] code
 *   bank1[offs] bits 0-5 colour, bit 6 flipx INVERTED, bit 7 flipy
 *   bank1[offs+1] y, as 241 - value
 * FLIPX IS ACTIVE LOW while flipy is active high -- reading them as a pair is wrong.
 * Offsets below LAST are not sprites.
 */
export const SPRITE_OFFS_FIRST = 0x3e;
export const SPRITE_OFFS_LAST = 0x10;

/**
 * Paint output rows [y0, y1] inclusive, into `out` in place.
 *
 * The unit MAME renders in: one partial update per visible line, each running the whole
 * three-layer screen_update clipped to it. With video disabled NOTHING is written and
 * those lines keep whatever the bitmap held -- the caller owns that buffer.
 *
 * @param {object} opts { videoEnabled, flipScreen }
 */
export function renderRowsRGB(out, y0, y1, mem, gfx, opts = {}) {
  const { videoEnabled = true, flipScreen = false } = opts;
  if (!videoEnabled) return;

  const { colorRam, videoRam, sprite0, sprite1 } = mem;
  const { tiles, sprites, palette } = gfx;

  const lo = y0 < 0 ? 0 : y0;
  const hi = y1 > SCREEN_H - 1 ? SCREEN_H - 1 : y1;

  // Scratch for the deferred category-1 cells of the row being painted. At most 32.
  const hiCells = new Int32Array(COLS);

  for (let row = lo; row <= hi; row++) {
    const ny = row + VISIBLE_Y0;
    const rowBase = row * SCREEN_W * 3;

    // Tilemap flip is a CELL mirror plus a per-tile flag XOR: mappings_update remaps
    // cell (col,row) to (cols-1-col, rows-1-row), tile_update XORs the flip flags.
    // Together those ARE a plain native mirror -- (31-c)*8 + (7-t) == 255 - (8c+t) --
    // so pick ONE; a pixel mirror ON TOP of the XOR flips twice and cancels. Scroll is
    // 0 on both axes here, so flipping adds no positional offset.
    const cellRow = (flipScreen ? ROWS - 1 - (ny >> 3) : ny >> 3) * COLS;
    const tileY = ny & 7;

    let nHi = 0;

    // Pass 1 + the category-1 census, one cell at a time.
    for (let cx = 0; cx < COLS; cx++) {
      const cell = cellRow + (flipScreen ? COLS - 1 - cx : cx);
      const attr = colorRam[cell];
      if ((attr & 0x10) !== 0) {
        hiCells[nHi++] = cx; // category 1: pass 3, over the sprites
        continue;
      }
      paintTileRow(out, rowBase, cx, cell, attr, tileY, videoRam, tiles, palette, flipScreen);
    }

    // Pass 2: sprites, transparent pen 0. The scan runs DOWNWARD, so the LOWEST offset
    // is painted last and wins where two sprites overlap.
    for (let offs = SPRITE_OFFS_FIRST; offs >= SPRITE_OFFS_LAST; offs -= 2) {
      const sy = 241 - sprite1[offs + 1];
      const sprRow = ny - sy;
      if (sprRow < 0 || sprRow >= SPRITE_H) continue;

      const sx = sprite0[offs];
      const code = sprite0[offs + 1];
      const ctrl = sprite1[offs];
      const color = ctrl & 0x3f;
      const flipx = (~ctrl & 0x40) !== 0;
      const flipy = (ctrl & 0x80) !== 0;

      const srcRow = flipy ? SPRITE_H - 1 - sprRow : sprRow;
      const src = code * 256 + srcRow * SPRITE_W;
      const penBase = SPRITE_PEN_BASE + color * 4;

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

    // Pass 3: category-1 tiles, opaque, over everything.
    for (let i = 0; i < nHi; i++) {
      const cx = hiCells[i];
      const cell = cellRow + (flipScreen ? COLS - 1 - cx : cx);
      paintTileRow(
        out, rowBase, cx, cell, colorRam[cell], tileY, videoRam, tiles, palette, flipScreen,
      );
    }
  }
}

/**
 * Paint the eight pixels of one tile cell on one row, OPAQUELY (pen 0 included).
 *
 *   code  = videoram[cell] + 8 * (attr & 0x20)   -- bit 5 is a 256-tile bank
 *   color = attr & 0x1f                          -- 32 colours of 4 pens
 *   flip  = TILE_FLIPYX(attr >> 6)               -- bit 6 flipX, bit 7 flipY
 *
 * READ THE MACRO, NOT ITS NAME: `TILE_FLIPYX(yx)` is the identity `yx & 3`, and
 * TILE_FLIPX is 0x01 -- so attr bit 6 is X. Reading "Y first" gets it backwards.
 */
function paintTileRow(out, rowBase, cx, cell, attr, tileY, videoRam, tiles, palette, flipScreen) {
  const code = videoRam[cell] + 8 * (attr & 0x20);
  const penBase = (attr & 0x1f) * 4;
  // The global screen flip XORs into each tile's own flags (tilemap_t::tile_update).
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

/**
 * A whole frame into a fresh buffer. A SNAPSHOT: equal to the hardware only when
 * nothing that matters changed mid-frame. The pixel gate uses the row-band path.
 * @returns {Uint8Array} RGB888, row-major, top-left, UNROTATED
 */
export function renderFrameRGB(mem, gfx, opts = {}) {
  const out = new Uint8Array(SCREEN_W * SCREEN_H * 3);
  renderRowsRGB(out, 0, SCREEN_H - 1, mem, gfx, opts);
  return out;
}
