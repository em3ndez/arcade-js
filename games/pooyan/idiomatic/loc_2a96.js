// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_2a01 } from "./loc_2a01.js";
import { STATE5_SIGCHECK_CODE_BASE_ADDR, STATE5_SIGCHECK_REF_TOP } from "./names.js";
/**
 * loc_2a96 — actor state-5 handler for the record at IX (dispatch slot 5). It runs a 0x20-byte
 * signature check: the checked code window read upward must equal a reversed reference block read
 * downward, byte for byte. A single mismatch tail-jumps into the state-2 handler (tamper re-entry).
 * On an intact image every byte matches, so it reseats the frame-hold, sets the flip bit, and
 * advances the record state before returning.
 *
 * LIVE-OUT: none — a tail-dispatched state handler run for its writes; the shared epilogue reloads
 * every register it consumes. The mismatch branch forwards the state-2 handler's return but is dead
 * on an intact image (both compared blocks are fixed program bytes the caller cannot alter).
 */

const HOLD_FIELD = 0x11; //   record offsets: frame-hold / flag / state
const FLAG_FIELD = 0x10;
const STATE_FIELD = 0x02;
const FRAME_HOLD_RESEED = 0x18;
const FLIP_BIT = 0x80;
const SIGCHECK_LEN = 0x20;

export function loc_2a96(m, rec = m.regs.ix) {
  const { mem8 } = m;

  let ref = STATE5_SIGCHECK_REF_TOP; //  reversed reference, read downward
  let src = STATE5_SIGCHECK_CODE_BASE_ADDR; // checked code window, read upward
  let count = SIGCHECK_LEN;
  for (;;) {
    if (mem8[ref] !== mem8[src]) return loc_2a01(m, rec); // tamper -> state-2 handler
    ref = u16(ref - 1);
    src = u16(src + 1);
    if (--count !== 0) continue;
    break;
  }

  mem8[rec + HOLD_FIELD] = FRAME_HOLD_RESEED;
  mem8[rec + FLAG_FIELD] |= FLIP_BIT;
  mem8[rec + STATE_FIELD] = mem8[rec + STATE_FIELD] + 1; // advance the state byte
}
