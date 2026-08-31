// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { verifyPlayfieldTileChecksum } from "./verifyPlayfieldTileChecksum.js";
import { HUNTER_COUNTER_PAGE, BOARD_CLEAR_FLAG } from "./names.js";
/**
 * tickHunterReturnCounterAndCheckBoardClear — per-slot hunter-return tick.
 *
 * WHAT IT IS
 *   One tick of the countdown that walks a driven-off hunter (an enemy bird) back toward its
 *   formation. Each active display-list slot carries a two-byte paced timer on the hunter-counter
 *   page; this routine advances one slot's timer by a single beat. When a slot's timer finally
 *   runs out AND the board is in its clearing phase, the routine diverts into the playfield
 *   tile-sum integrity check instead of returning normally.
 *
 * ROLE IN THE MACHINE
 *   The 4-slot scan scanDisplaySlotsAndTickBoardClear points at each qualifying display-list slot
 *   in turn and calls this routine once per slot, so the per-slot work here is the body of that
 *   scan. The slot record's field-0 (the byte this routine reads first) does double duty: it is
 *   both the activity gate and the low index that selects this slot's timer cell.
 *
 * ROM ADDRESS
 *   0x324d-0x3265.
 *
 * GROUNDING
 *   [seen].
 *
 * MECHANISM
 *   The counter cell is a coarse fractional timer that is dropped by one fixed step (0x40) each
 *   tick; a step that borrows past zero is one elapsed "beat", and each beat decrements the whole
 *   count held in the paired byte one cell up. So the two bytes together form a fraction/whole
 *   pair: low cell = sub-beat phase, high cell = beats remaining.
 *
 * LIVE-OUT: none on the ordinary paths (the scan caller's loop counter is preserved); the
 * board-clear tail-call forwards the check's own register result.
 */

// 0x40 serves two roles at once: the minimum field-0 value for a slot to be active, and the
// fixed amount the paced sub-beat counter is dropped by on every tick.
const RETURN_THRESHOLD = 0x40; // field-0 gate; also the per-tick counter step
// The counter cell for a slot sits at field-0 + 5 within the hunter-counter page.
const COUNTER_INDEX_BIAS = 0x05;

export function tickHunterReturnCounterAndCheckBoardClear(m, rec = m.regs.ix) {
  const { mem8 } = m;
  // Field-0 of the slot record (rec+0): the activity level / timer index for this hunter slot.
  const slot = mem8[rec];
  // Activity gate: slots whose field-0 has not reached 0x40 are not returning yet, so skip them
  // entirely and leave the scan's state untouched.
  if (slot < RETURN_THRESHOLD) return;

  // Locate this slot's paced-timer cell on the hunter-counter page (0x8c00): the low byte is
  // (field-0 + 5) wrapped to a page offset, the high byte is forced to the 0x8c page.
  const counter = HUNTER_COUNTER_PAGE | ((slot + COUNTER_INDEX_BIAS) & 0xff);
  // Read the current sub-beat phase, drop it by one fixed step (0x40), and store it back. The
  // 8-bit cell wraps on underflow, so a drop past zero leaves the low bits and signals a borrow.
  const before = mem8[counter];
  mem8[counter] = (before - RETURN_THRESHOLD);
  // No borrow (the phase was still at or above one step): this beat has not fully elapsed, the
  // hunter is not ready to take a step yet, so return.
  if (before >= RETURN_THRESHOLD) return; // no borrow: counter still has time

  // A beat elapsed: charge it against the whole-count byte one cell up (beats remaining), so the
  // fraction/whole timer pair advances together.
  const paired = u16(counter + 1);
  mem8[paired] = (mem8[paired] - 1);
  // Board-clear divert: while BOARD_CLEAR_FLAG (0x89e5) is raised the board is being cleared, so
  // instead of an ordinary return this hands off to the playfield tile-sum integrity check and
  // returns whatever it returns; otherwise fall through to a plain return.
  if (mem8[BOARD_CLEAR_FLAG] !== 0) return verifyPlayfieldTileChecksum(m); // board clearing: run the tile-sum check
}
