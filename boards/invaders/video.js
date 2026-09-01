// SPDX-License-Identifier: GPL-3.0-only
// Space Invaders video (mw8080bw_v.cpp screen_update_invaders): 1bpp bitmap in main_ram 0x2400-0x3FFF
// -> monochrome RGB888. For row r (0..223), col c (0..255): byte = ram[0x400 + r*32 + (c>>3)],
// pixel = (byte >> (c&7)) & 1 (LSB leftmost), set=white. Emits the PRE-rotation 256x224 frame; ROT270
// is display-only, applied downstream (as pooyan emits pre-rotation). ★ first pixel-gate: colour is a
// physical overlay (not in the bitmap) and the 4-px shift-register flush only shows at the right edge.

export const SCREEN_W = 256;
export const SCREEN_H = 224;
export const FB_OFFSET = 0x0400; // 0x2400 - 0x2000
export const BYTES_PER_ROW = 32;

const WHITE = [0xff, 0xff, 0xff];
const BLACK = [0x00, 0x00, 0x00];

/** Render main_ram (index 0 = 0x2000) to a row-major RGB888 frame, SCREEN_W*SCREEN_H*3 bytes. */
export function renderFrame(ram, out) {
  out = out || new Uint8Array(SCREEN_W * SCREEN_H * 3);
  let o = 0;
  for (let r = 0; r < SCREEN_H; r++) {
    const rowBase = FB_OFFSET + r * BYTES_PER_ROW;
    for (let c = 0; c < SCREEN_W; c++) {
      const bit = (ram[rowBase + (c >> 3)] >> (c & 7)) & 1;
      const px = bit ? WHITE : BLACK;
      out[o++] = px[0];
      out[o++] = px[1];
      out[o++] = px[2];
    }
  }
  return out;
}
