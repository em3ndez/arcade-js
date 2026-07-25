// SPDX-License-Identifier: GPL-3.0-only
/**
 * The Pit video renderer (FIRST DRAFT for the game #2 port).
 *
 * Modeled from MAME src/mame/taito/roundup.cpp (roundup_palette, get_tile_info,
 * solid_get_tile_info, draw_sprites, screen_update). Native raster 256x224, ROT90.
 *
 * The picture is composed in five layers, in this order (later overwrites earlier):
 *   1. solid background blocks, low-priority cells  (colorram bits 4-6 -> synthetic pen)
 *   2. foreground char tiles                         (videoram = code, colorram bits 0-2)
 *   3. sprites, low priority                         (spriteram[+2] bit 3 == 0)
 *   4. solid background blocks, high-priority cells  (drawn OVER sprites)
 *   5. sprites, high priority                        (spriteram[+2] bit 3 == 1)
 *
 * A tile cell is EITHER low- or high-priority: category = (back_color != 0) && bit7 clear.
 * Each of the 32 columns scrolls vertically by attributesram[col*2].
 *
 * UNVALIDATED until the golden harness exists — flip-screen math, the exact sprite
 * origin, and the sprite clip rectangle in particular need pixel confirmation vs MAME.
 */

export const SCREEN_W = 256;
export const SCREEN_H = 224;

/** Decode the 32-byte colour PROM into 40 [r,g,b] pens (32 tile/sprite + 8 synthetic). */
export function decodePalette(prom) {
  const w = [0x21, 0x47, 0x97];
  const pal = [];
  for (let i = 0; i < 32; i++) {
    const c = prom[i];
    const r = w[0] * (c & 1) + w[1] * ((c >> 1) & 1) + w[2] * ((c >> 2) & 1);
    const g = w[0] * ((c >> 3) & 1) + w[1] * ((c >> 4) & 1) + w[2] * ((c >> 5) & 1);
    const b = w[1] * ((c >> 6) & 1) + w[2] * ((c >> 7) & 1); // blue bit0 is always 0
    pal.push([r, g, b]);
  }
  // 8 synthetic background primaries (pens 32-39). MAME notes "this is wrong, but I
  // don't know where to pick the colors from" -- carried faithfully.
  for (let i = 0; i < 8; i++) {
    pal.push([(i >> 2) & 1 ? 0xff : 0, (i >> 1) & 1 ? 0xff : 0, i & 1 ? 0xff : 0]);
  }
  return pal;
}

/**
 * 2bpp pixel of an 8x8 char tile (gfx region: plane0 at 0x0000, plane1 at 0x1000).
 * @returns 0..3 (0 = transparent for foreground tiles).
 */
function charPixel(gfx, code, tx, ty) {
  const row = code * 8 + ty;
  const p0 = (gfx[row] >> (7 - tx)) & 1;
  const p1 = (gfx[row + 0x1000] >> (7 - tx)) & 1;
  return p0 | (p1 << 1);
}

/**
 * 2bpp pixel of a 16x16 sprite. spritelayout: 64 sprites, 32 bytes each; the four 8x8
 * quadrants are interleaved per the STEP layout (top-left, bottom-left, top-right,
 * bottom-right). planes at gfx 0x0000 / 0x1000.
 */
function spritePixel(gfx, code, tx, ty) {
  // quadrant + in-quadrant offset, matching spritelayout's STEP8 x/y ordering
  const col = tx & 7, row = ty & 7;
  const qx = tx >> 3, qy = ty >> 3;
  const base = code * 32 + qy * 8 + qx * 16 + row;
  const p0 = (gfx[base] >> (7 - col)) & 1;
  const p1 = (gfx[base + 0x1000] >> (7 - col)) & 1;
  return p0 | (p1 << 1);
}

/**
 * Render one frame into a 256x224 RGB byte buffer.
 * @param {object} m   AddressSpace (reads .videoRam, .colorRam, .attrsprRam)
 * @param {Uint8Array} gfx  the 0x1800 gfx image (p9@0x0000, p8@0x1000)
 * @param {Array} pal  decodePalette() output
 * @param {object} io  { flipX, flipY }
 * @returns {Uint8Array} SCREEN_W*SCREEN_H*3 RGB
 */
export function renderFrame(m, gfx, pal, io) {
  const out = new Uint8Array(SCREEN_W * SCREEN_H * 3);
  const vram = m.videoRam, cram = m.colorRam, attr = m.attrsprRam, spr = m.attrsprRam.subarray(0x40, 0x60);
  const flipX = io && io.flipX, flipY = io && io.flipY;

  // index-pen framebuffer + per-pixel cell category (0 = low, 1 = high priority bg)
  const pen = new Int16Array(SCREEN_W * SCREEN_H).fill(-1);
  const hiBg = new Uint8Array(SCREEN_W * SCREEN_H); // pen to redraw over sprites, +1 (0 = none)

  for (let sy = 0; sy < SCREEN_H; sy++) {
    for (let sx = 0; sx < SCREEN_W; sx++) {
      const col = sx >> 3;
      const scrollY = attr[(col << 1)]; // per-column Y scroll
      const ty = (sy + scrollY) & 0xff; // tilemap is 256 tall, wraps
      const cell = (ty >> 3) * 32 + col;
      const cinfo = cram[cell];

      const backColor = (cinfo >> 4) & 7;
      const category = backColor !== 0 && (cinfo & 0x80) === 0 ? 1 : 0;
      const solidPen = 32 + backColor;

      const p = sy * SCREEN_W + sx;

      // layer 1: low-priority solid background
      if (category === 0) pen[p] = solidPen;

      // layer 2: foreground char (transparent pen 0)
      const fp = charPixel(gfx, vram[cell], sx & 7, ty & 7);
      if (fp !== 0) pen[p] = (cinfo & 7) * 4 + fp;

      // layer 4 deferred: remember the high-priority bg pen to paint over sprites
      if (category === 1) hiBg[p] = solidPen + 1;
    }
  }

  // layer 3 + 5: sprites. draw_sprites iterates 8 sprites (spriteram 0x9840-0x985F),
  // from last to first, per priority. Draw low-pri here, then hi-bg, then hi-pri.
  const drawSprites = (wantPri) => {
    for (let offs = spr.length - 4; offs >= 0; offs -= 4) {
      if (((spr[offs + 2] & 0x08) >> 3) !== wantPri) continue;
      if (spr[offs + 0] === 0 || spr[offs + 3] === 0) continue;
      let y = (240 - spr[offs]) & 0xff;
      let x = (spr[offs + 3] + 1) & 0xff;
      let fx = (spr[offs + 1] & 0x40) !== 0;
      let fy = (spr[offs + 1] & 0x80) !== 0;
      if (flipY) { y = (240 - y) & 0xff; fy = !fy; }
      if (flipX) { x = (242 - x) & 0xff; fx = !fx; }
      if (offs < 16) y = (y + 1) & 0xff; // sprites 0-3 one pixel down
      const code = spr[offs + 1] & 0x3f;
      for (let py = 0; py < 16; py++) {
        for (let px = 0; px < 16; px++) {
          const sxp = (x + px) & 0xff, syp = (y + py) & 0xff;
          if (sxp >= SCREEN_W || syp >= SCREEN_H) continue;
          const pix = spritePixel(gfx, code, fx ? 15 - px : px, fy ? 15 - py : py);
          if (pix === 0) continue; // transparent
          const p = syp * SCREEN_W + sxp;
          const color = spr[offs + 2];
          pen[p] = (color & 7) * 4 + pix;
          if (wantPri === 0 && hiBg[p]) pen[p] = hiBg[p] - 1; // hi-pri bg wins over lo sprite
        }
      }
    }
  };
  drawSprites(0);
  // layer 4: paint high-priority bg over the low-priority sprites
  for (let p = 0; p < hiBg.length; p++) if (hiBg[p]) pen[p] = hiBg[p] - 1;
  drawSprites(1);

  // resolve pens -> RGB (uncovered pixels default to pen 0)
  for (let p = 0; p < pen.length; p++) {
    const rgb = pal[pen[p] < 0 ? 0 : pen[p]] || [0, 0, 0];
    out[p * 3] = rgb[0];
    out[p * 3 + 1] = rgb[1];
    out[p * 3 + 2] = rgb[2];
  }
  return out;
}
