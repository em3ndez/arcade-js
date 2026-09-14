// SPDX-License-Identifier: GPL-3.0-only
import { packBinaryToBcd } from "./packBinaryToBcd.js";
import { emitNibbleDigitRun } from "./emitNibbleDigitRun.js";

// Pack the incoming byte to BCD, then emit that single zeropage byte as nibbles.
export function loc_af77(m, a = m.regs.a) {
  packBinaryToBcd(m, a);
  emitNibbleDigitRun(m, 0x29, 0x01);
}
