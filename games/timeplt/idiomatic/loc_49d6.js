// SPDX-License-Identifier: GPL-3.0-only
/** loc_49d6 — drive one hardware output line as a train of square pulses, one pulse per unit of a
 * pending count, and stop when the count reaches zero.
 * With nothing pending it does nothing at all. With something pending and no pulse under way it
 * arms a fixed-length phase counter and raises the line. Otherwise it counts that phase down one
 * per call: at exactly the halfway value it drops the line again, so the line is high for the
 * first half of a phase and low for the second; at zero it takes one off the pending count, which
 * lets the next call start the next pulse. The halfway test is an equality, so a phase counter
 * disturbed past that value from outside would run the whole phase with the line still high.
 * LIVE-OUT: memory, plus the output line. */

import { u8 } from "../../../core/int.js";

const PENDING = 0xa982;
const PHASE = 0xa985;
const PHASE_LENGTH = 48;
const HALFWAY = 24;
const OUTPUT_LINE = 0xc30c;
const WRITE_BUS_OFFSET_OF_A_FIXED_ADDRESS_STORE = 10;

export function loc_49d6(m) {
  const { mem8 } = m;
  if (mem8[PENDING] === 0) return;

  if (mem8[PHASE] === 0) {
    mem8[PHASE] = PHASE_LENGTH;
    m.mem.write8(OUTPUT_LINE, 1, WRITE_BUS_OFFSET_OF_A_FIXED_ADDRESS_STORE);
    return;
  }

  const phase = u8(mem8[PHASE] - 1);
  mem8[PHASE] = phase;
  if (phase === 0) {
    mem8[PENDING] = u8(mem8[PENDING] - 1);
    return;
  }
  if (phase === HALFWAY) m.mem.write8(OUTPUT_LINE, 0, WRITE_BUS_OFFSET_OF_A_FIXED_ADDRESS_STORE);
}
