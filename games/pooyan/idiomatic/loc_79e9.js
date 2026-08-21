// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { SELFCHECK_ROUTINE_BASE_ADDR, TAIL_CHECKSUM_GUARD } from "./names.js";
import { loc_1a85 } from "./loc_1a85.js";
/**
 * loc_79e9 — code-region integrity self-check.
 *
 * Sums the bytes of a fixed routine (forward from its base until the terminating 0xc9 return
 * opcode) into a 16-bit accumulator — a low byte plus a carry count as the high byte — and
 * matches it against the stored expected word. A low-byte miss is an integrity trap (unreachable
 * while the summed bytes are intact); a high-byte miss diverts to the phase-gauge / sub-state
 * path; a clean match just falls through.
 *
 * LIVE-OUT: DE = the 16-bit checksum the sum produced. Declared and set (via the return-assignment
 * bridge) to give this otherwise write-free routine a testable contract; no caller is known to read it.
 */

const RET_OPCODE = 0xc9; // the summed routine's terminating `ret`, which ends the scan

export function loc_79e9(m) {
  const { mem8 } = m;

  let low = 0;
  let high = 0;
  let addr = SELFCHECK_ROUTINE_BASE_ADDR;
  while (mem8[addr] !== RET_OPCODE) {
    const acc = low + mem8[addr];
    low = acc & 0xff;
    if (acc > 0xff) high = (high + 1) & 0xff; // carry out of the low byte
    addr = u16(addr + 1);
  }

  if (low !== mem8[TAIL_CHECKSUM_GUARD]) {
    throw new Error("loc_79e9: checksum low-byte mismatch (integrity trap, unreachable while the summed bytes are intact)");
  }
  if (high !== mem8[u16(TAIL_CHECKSUM_GUARD + 1)]) {
    return loc_1a85(m); // high-byte mismatch diversion
  }
  return (m.regs.de = (high << 8) | low); // DE live-out: the computed checksum
}
