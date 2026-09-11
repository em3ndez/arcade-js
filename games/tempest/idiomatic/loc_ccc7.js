// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { loc_31, loc_32, loc_bf, loc_c0, loc_e0, loc_f0, loc_cb01 } from "./names.js";

// Register a sound: for each of 16 slots read the sound's next table byte; a nonzero
// byte claims that slot, stamping its value and two live flags. Preserves caller X/Y.
export function loc_ccc7(m, a = m.regs.a, x = m.regs.x, y = m.regs.y) {
  const { mem8 } = m;
  mem8[loc_31] = x;
  mem8[loc_32] = y;
  let id = a & 0xff;
  for (let slot = 0x0f; slot >= 0; slot--, id = u8(id - 1)) {
    const b = mem8[u16(loc_cb01 + id)];
    if (b === 0) continue;
    mem8[loc_bf] = slot;
    mem8[u8(loc_c0 + slot)] = b;
    mem8[u8(loc_e0 + slot)] = 0x01;
    mem8[u8(loc_f0 + slot)] = 0x01;
    mem8[loc_bf] = 0xff;
  }
}
