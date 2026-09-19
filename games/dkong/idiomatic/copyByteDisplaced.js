// SPDX-License-Identifier: GPL-3.0-only
/**
 * copyByteDisplaced — generic addressing primitive: copy the byte at base+index (HL+BC) to
 * base+index+displacement (+DE). Both additions are 16-bit and wrap.
 *
 * LIVE-OUT: memory-only — the one byte written at the displaced address.
 */
import { u16 } from "../../../core/int.js";

export function copyByteDisplaced(m, hl = m.regs.hl, bc = m.regs.bc, de = m.regs.de) {
  const { mem8 } = m;

  const src = u16(hl + bc);
  const dst = u16(src + de);
  mem8[dst] = mem8[src];
}
