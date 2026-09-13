// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { GAME_MODE, MODE_DISPATCH_SEL, GAME_MODE_PENDING, FRAME_COUNTER, PREV_Y_LO, PREV_Y_HI, PREV_X_LO, PREV_X_HI, DRAW_CURSOR_LO, DRAW_CURSOR_HI } from "./names.js";
import { loc_df5f } from "./loc_df5f.js";

// Emit a fixed header word then two coordinate words (each high byte clamped to 5 bits)
// from two zeropage pairs through the write cursor, caching the raw bytes, then advance
// the cursor past the six emitted bytes. loc_c772 is the entry that starts the cursor at 0.
export function loc_c772(m, x = m.regs.x) {
  return loc_c774(m, x, 0);
}

export function loc_c774(m, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;
  const base = mem8[DRAW_CURSOR_LO] | (mem8[DRAW_CURSOR_HI] << 8);

  mem8[u16(base + y)] = 0x40; y = u8(y + 1);
  mem8[u16(base + y)] = 0x80; y = u8(y + 1);

  const xLo = mem8[u8(GAME_MODE_PENDING + x)];
  mem8[PREV_X_LO] = xLo;
  mem8[u16(base + y)] = xLo; y = u8(y + 1);

  const xHi = mem8[u8(FRAME_COUNTER + x)];
  mem8[PREV_X_HI] = xHi;
  mem8[u16(base + y)] = xHi & 0x1f;

  const yLo = mem8[u8(GAME_MODE + x)];
  mem8[PREV_Y_LO] = yLo; y = u8(y + 1);
  mem8[u16(base + y)] = yLo;

  const yHi = mem8[u8(MODE_DISPATCH_SEL + x)];
  mem8[PREV_Y_HI] = yHi; y = u8(y + 1);
  mem8[u16(base + y)] = yHi & 0x1f;

  return loc_df5f(m, y);
}
