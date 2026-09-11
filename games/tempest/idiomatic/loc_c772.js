// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { loc_00, loc_1, loc_2, loc_3, loc_6a, loc_6b, loc_6c, loc_6d, loc_74, loc_75 } from "./names.js";
import { loc_df5f } from "./loc_df5f.js";

// Emit a fixed header word then two coordinate words (each high byte clamped to 5 bits)
// from two zeropage pairs through the write cursor, caching the raw bytes, then advance
// the cursor past the six emitted bytes. loc_c772 is the entry that starts the cursor at 0.
export function loc_c772(m, x = m.regs.x) {
  return loc_c774(m, x, 0);
}

export function loc_c774(m, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;
  const base = mem8[loc_74] | (mem8[loc_75] << 8);

  mem8[u16(base + y)] = 0x40; y = u8(y + 1);
  mem8[u16(base + y)] = 0x80; y = u8(y + 1);

  const xLo = mem8[u8(loc_2 + x)];
  mem8[loc_6c] = xLo;
  mem8[u16(base + y)] = xLo; y = u8(y + 1);

  const xHi = mem8[u8(loc_3 + x)];
  mem8[loc_6d] = xHi;
  mem8[u16(base + y)] = xHi & 0x1f;

  const yLo = mem8[u8(loc_00 + x)];
  mem8[loc_6a] = yLo; y = u8(y + 1);
  mem8[u16(base + y)] = yLo;

  const yHi = mem8[u8(loc_1 + x)];
  mem8[loc_6b] = yHi; y = u8(y + 1);
  mem8[u16(base + y)] = yHi & 0x1f;

  return loc_df5f(m, y);
}
