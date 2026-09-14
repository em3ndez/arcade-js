// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import {
  VG_RECORD_HEADER, loc_414, MATHBOX_LD_R6_COUNT, MATHBOX_LD_RA_HI, MATHBOX_LD_RB_LO, MATHBOX_LD_RB_HI, MATHBOX_DIVIDE,
  MATHBOX_STATUS, MATHBOX_RESULT_LO, MATHBOX_RESULT_HI,
} from "./names.js";

/**
 * runMathboxDivide — prime the AVG math-box, kick a divide, and read back the first ready result. ROM 0xdce6.
 *
 * Role in the machine: Tempest offloads the 16-bit divides that place objects along the tube onto a
 * hardware math coprocessor ("mathbox") wired into the AVG address space. This routine loads that
 * coprocessor's operand and iteration-count registers from the caller's A (dividend/operand hi) and X
 * (divisor lo), triggers the divide, then polls a short window for the answer and returns the low/high
 * result pair to the caller in A (lo) and Y (hi). It is the compute primitive behind the per-frame vector
 * readout emit (emitReadoutVectorList calls it to decide the POKEY operand and status).
 *
 * Behavior: first it zeros two vector-record staging cells (VG_RECORD_HEADER and loc_414). It then writes
 * the operand registers — MATHBOX_LD_RA_HI = a, MATHBOX_LD_RB_LO = x, MATHBOX_LD_RB_HI = 0 — seeds the
 * step count MATHBOX_LD_R6_COUNT = 0x10, and strobes MATHBOX_DIVIDE to start the operation. The poll loop
 * counts X down from 0x10; each pass it pre-decrements X and bails the moment X goes negative (bit 7 set),
 * i.e. the coprocessor never reported ready within the window. Otherwise it reads MATHBOX_STATUS: a set
 * bit 7 means "still busy", so it keeps spinning; once busy clears it latches MATHBOX_RESULT_LO into A and
 * MATHBOX_RESULT_HI into Y and breaks. The routine writes A/X/Y back into m.regs and returns them.
 *
 * Live-out: A = result low (or last status read on a timeout), Y = result high, X = the loop residue
 * (0xff on a run-past-end timeout, else the count at the ready slot); the mathbox operand/count/divide
 * registers are left loaded; VG_RECORD_HEADER and loc_414 are cleared. Grounding: [seen].
 */
export function runMathboxDivide(m, a = m.regs.a, x = m.regs.x) {
  const { mem8 } = m;
  let y = 0x00;
  // Clear the vector-record staging cells before loading operands.
  mem8[VG_RECORD_HEADER] = 0x00;
  mem8[loc_414] = 0x00;
  // Load the mathbox operand registers from A (hi) and X (lo); high divisor byte is zero.
  mem8[MATHBOX_LD_RA_HI] = a;
  mem8[MATHBOX_LD_RB_LO] = x;
  mem8[MATHBOX_LD_RB_HI] = 0x00;
  mem8[MATHBOX_LD_R6_COUNT] = 0x10; // iteration count
  mem8[MATHBOX_DIVIDE] = 0x10;      // strobe: start the divide
  // Poll up to 16 times for a ready result.
  for (x = 0x10; ; ) {
    x = u8(x - 1);
    if (x & 0x80) break;              // window exhausted (X went negative) -> no result
    a = mem8[MATHBOX_STATUS];
    if (a & 0x80) continue;           // still busy -> keep polling
    a = mem8[MATHBOX_RESULT_LO];      // ready: latch low result...
    y = mem8[MATHBOX_RESULT_HI];      // ...and high result
    break;
  }
  return [(m.regs.a = a & 0xff), (m.regs.x = x & 0xff), (m.regs.y = y & 0xff)];
}
