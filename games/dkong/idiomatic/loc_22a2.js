// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_22a2 — one idle-then-descend tick for a BOARD_OBJ_SCRATCH object, resetting it
 * to state 0 when it reaches the bottom of its travel.  ROM 0x22A2.
 *
 * One arm of the sub_2207 object state machine, entered with a pointer to the object's
 * record — one of the two 8-byte BOARD_OBJ_SCRATCH records the dispatcher selects by
 * frame parity. The record base arrives on the stack; here it is an honest parameter.
 *
 * Field +4 is a per-tick countdown: it is decremented every time this arm runs, and
 * until it underflows to zero the object simply idles for this tick. On the tick it
 * underflows, the countdown is reloaded and the object's position counter (field +3) is
 * stepped DOWN by one, then that new position is mirrored into the object's on-screen
 * sprite position cell (via loc_22bd, which routes it to one of two sprite slots by the
 * pointer's bit 3). When the position counter reaches the bottom of its travel (0x68),
 * the object is reset: field +1 is set to 0x80 and the state byte (field +0) is cleared,
 * sending the object back to state 0 of the state machine. The sibling arm loc_2259 is
 * the mirror image — it steps the same counter UP toward 0x78 and advances the state.
 *
 * Every field address is taken within the record's own memory page (the original pointer
 * walk steps only the low byte), so a field access never crosses a page boundary.
 *
 * Memory-equivalent to the frozen oracle — equivalence-22a2.test.js.
 * GATE:     crafted, exhaustive by factorisation. The sub_2207 board gate is closed in
 *           attract, so this arm never dispatches there (0 natural in 2000 frames) and real
 *           captures are unavailable; but the observable effect factorises into the idle
 *           path (depends only on the countdown) and the fire path (depends only on the
 *           position counter), each swept over all 256 values on BOTH real records — which
 *           between them exercise both sprite slots (bit 3 clear / set). Teeth: a wrong
 *           reload twin, a counter-goes-up twin, and a dropped reset-write twin.
 * LIVE-OUT: memory-only — the object-machine cascade that tail-calls this arm discards its
 *           residual registers/flags, and its terminal return is dead ABI. The record base
 *           it takes on the stack becomes a parameter, and the display-mirror call is a
 *           direct call, so the oracle's push/return bracket around that call is dropped —
 *           its dead scratch write lands in STACK_SCRATCH, excluded by the equivalence gate.
 * NAMES:    the record base is a BOARD_OBJ_SCRATCH (0x6280) record, passed in — the routine
 *           hardcodes no absolute cell. Fields +0/+1/+3/+4 are addressed relative to it; the
 *           two sprite destination cells live inside the loc_22bd callee (unnamed in ram.js).
 */

import { loc_22bd } from "./loc_22bd.js"; // ROM 0x22BD — display mirror

/**
 * @param {object} m          the machine (uses m.mem only).
 * @param {number} recordBase base pointer of the object's record (a BOARD_OBJ_SCRATCH
 *                            record — 0x6280 or 0x6288).
 * @returns {void}
 */
export function loc_22a2(m, recordBase) {
  const { mem } = m;

  // Address of record field N, kept on the record's own page (the pointer walk steps only
  // the low byte, so a field address never crosses a page boundary).
  const field = (n) => (recordBase & 0xff00) | ((recordBase + n) & 0xff);

  // Field +4 — per-tick countdown. Step it down every tick; idle until it underflows.
  const countdown = (mem.read8(field(4)) - 1) & 0xff;
  mem.write8(field(4), countdown);
  if (countdown !== 0) return;

  // Underflowed: reload the countdown and step the position counter (+3) DOWN by one.
  mem.write8(field(4), 0x02);
  const position = (mem.read8(field(3)) - 1) & 0xff;
  mem.write8(field(3), position);

  // Mirror the new position into this object's on-screen sprite position cell.
  loc_22bd(m, field(3));

  // Still descending — stop until the counter reaches the bottom of its travel.
  if (position !== 0x68) return;

  // Bottom reached: reset the object — field +1 to 0x80, then the state byte (+0) to 0,
  // returning it to state 0 of the object state machine.
  mem.write8(field(1), 0x80);
  mem.write8(field(0), 0x00);
}
