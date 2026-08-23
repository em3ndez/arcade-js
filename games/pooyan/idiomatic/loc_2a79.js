// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_29a0 } from "./loc_29a0.js";
import { STATE4_SIGCHECK_CODE_BASE_ADDR, STATE5_SIGCHECK_REF_TOP } from "./names.js";
/**
 * loc_2a79 — actor state-4 handler for the record at IX (dispatch slot 4). It runs a 0x68-byte
 * signature check: a fixed program window and a stored reference block, both read upward, must
 * match byte for byte. A single mismatch tail-jumps into the state-1 handler (tamper re-entry).
 * On an intact image every byte matches, so it reseats the frame-hold, clears the flip bit, and
 * advances the record state before returning.
 *
 * LIVE-OUT: none — a tail-dispatched state handler run for its writes; the shared epilogue reloads
 * every register it consumes. The mismatch branch forwards the state-1 handler's return but is dead
 * on an intact image (both compared blocks are fixed program bytes the caller cannot alter).
 */

const HOLD_FIELD = 0x11; //   record offsets: frame-hold / flag / state
const FLAG_FIELD = 0x10;
const STATE_FIELD = 0x02;
const FRAME_HOLD_RESEED = 0x30;
const FLIP_BIT = 0x80;
const SIGCHECK_LEN = 0x68;

export function loc_2a79(m, rec = m.regs.ix) {
  const { mem8 } = m;

  let code = STATE4_SIGCHECK_CODE_BASE_ADDR; // checked program window, read upward
  let ref = STATE5_SIGCHECK_REF_TOP;         // reference block, read upward
  let count = SIGCHECK_LEN;
  for (;;) {
    if (mem8[ref] !== mem8[code]) return loc_29a0(m, rec); // tamper -> state-1 handler
    code = u16(code + 1);
    ref = u16(ref + 1);
    if (--count !== 0) continue;
    break;
  }

  mem8[rec + HOLD_FIELD] = FRAME_HOLD_RESEED;
  mem8[rec + FLAG_FIELD] &= ~FLIP_BIT;                    // clear the flip bit
  mem8[rec + STATE_FIELD] = mem8[rec + STATE_FIELD] + 1;  // advance the state byte
}
