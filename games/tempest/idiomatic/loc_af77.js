// SPDX-License-Identifier: GPL-3.0-only
import { loc_aaf5 } from "./loc_aaf5.js";
import { loc_dfb1 } from "./loc_dfb1.js";

// Pack the incoming byte to BCD, then emit that single zeropage byte as nibbles.
export function loc_af77(m, a = m.regs.a) {
  loc_aaf5(m, a);
  loc_dfb1(m, 0x29, 0x01);
}
