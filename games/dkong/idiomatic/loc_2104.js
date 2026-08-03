// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2104 — retire an object record once its X has run down to the bottom of the range,
 * otherwise hand the record on unchanged.  ROM 0x2104.
 *
 * Reads the record's OBJ_X (+3). Writes, on the retire arm only, OBJ_ACTIVE (+0) and
 * OBJ_X (+3), both zeroed. Nothing else in the record is touched.
 *
 * The test is on X + 8 taken at eight-bit width, not on X, so an X that has run down PAST
 * zero and wrapped to 248..255 counts as retired just as 0..7 does. That wrap is the one
 * genuinely load-bearing width artifact here: without it a record whose X has gone
 * negative would be handed on as if it were at the far end of the range.
 *
 * Both exits are hand-offs, not returns — control leaves this routine for good and the
 * value the hand-off produces is forwarded straight back to this routine's caller:
 *   above the limit -> ROM 0x1FCE, which steps the record's +0x0F countdown and toggles
 *                      +0x07 before joining the shared object-sprite tail;
 *   at or below     -> ROM 0x21BA, that same shared tail, entered directly.
 * Either way the record's four sprite fields are gathered and the caller's ten-record
 * sweep continues, so a retired record is still published this frame — with the zeroed X
 * this routine just wrote.
 *
 * WHAT THIS DOES IN THE GAME, and what that rests on: OBJ_ACTIVE is the object-record
 * array's own "is this slot live" flag (ram.js grounds it live on OBJ_ARRAY_67), so
 * zeroing it frees the slot; the accompanying zero of OBJ_X is what stops the freed slot
 * from being drawn where it died. The pairing is not read off this body alone — the
 * sibling gate at ROM 0x24B4, which the caller at ROM 0x2101 runs immediately before
 * falling in here, makes the SAME two writes (+0 and +3, both zero) once the record's
 * position lands in the window it watches, and then joins the same shared tail. Two
 * independent bodies agree on the idiom.
 * NOT CLAIMED: which physical screen edge X = 0 is, and why the margin is 8 rather than
 * some other value, were not derived. Nor was the identity of the objects that reach
 * here — attract only ever dispatches this on OBJ_ARRAY_67 records 0 and 1.
 *
 * The record base arrives in the index register and is deliberately NOT a parameter: both
 * hand-off targets are still frozen and read the record straight off that register, so a
 * caller passing a different base would be obeyed by these three lines and ignored one
 * hand-off later. It becomes an honest parameter once ROM 0x1FCE and 0x21BA are
 * decompiled.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2104.test.js.
 * GATE:     ATTRACT plus CRAFTED. Every one of the 382 real dispatches in a 6000-frame
 *           attract run is replayed inline (no sampling), oracle against rewrite on
 *           byte-identical clones, comparing work/sprite/video RAM outside STACK_SCRATCH,
 *           the forwarded return value, pc and SP. All 382 land on the above-the-limit
 *           arm with X only ever in 59..72, so the retire arm, the boundary values and
 *           the wrap are CRAFTED on a real captured entry. A second replay with both
 *           hand-off targets stubbed isolates this routine's own write set and records
 *           which target was taken. Teeth: five broken twins — an inverted limit and a
 *           swallowed hand-off return, both caught by the captured replay; a dropped
 *           margin, a dropped wrap and a retire arm that leaves X behind, reachable only
 *           from the crafted entries. The live-wire arm below carries its own teeth in the
 *           dispatch count: a twin that retires the record wrongly is dispatched once
 *           rather than 171 times, because the record it wrongly freed never comes back.
 * LIVE-OUT: the two record fields, and the value the hand-off returns — this routine
 *           forwards it and adds nothing of its own. DERIVED: exactly two sites reach
 *           here, both frozen (the branch at ROM 0x20F7, and the fall-through at the end
 *           of ROM 0x2101); both are tail hand-offs, so neither reads a register back —
 *           and the two hand-off targets overwrite the accumulator before reading it and
 *           set their own flags before testing any, which is why the residual registers
 *           and flags are dropped. MEASURED: the rewrite wired live at 0x2104 for 2000
 *           attract frames (171 dispatches) leaves the state dump byte-identical to the
 *           all-oracle baseline on every frame, stack scratch INCLUDED — this routine
 *           keeps the oracle's hand-off calls, so the guest stack must match too.
 * NAMES:    OBJ_ACTIVE (+0) and OBJ_X (+3) from ram.js. The record base is not a fixed
 *           cell — it is whatever record the caller's sweep is on (attract drives
 *           OBJ_ARRAY_67 records 0 and 1), so it stays a register read.
 */

import { u8 } from "../../../core/int.js";
import { OBJ_ACTIVE, OBJ_X } from "./ram.js";

/** X strictly below this, after the wrap-tolerant shift, retires the record. */
const X_LIMIT = 16;
/** How far past zero an X may already have wrapped and still count as at the limit. */
const WRAP_MARGIN = 8;

/**
 * @param {object} m  the machine; the record base is read from its index register.
 * @returns {*} whatever the hand-off target returns, forwarded unchanged.
 */
export function loc_2104(m) {
  const { mem8 } = m;
  const record = m.regs.ix;

  if (u8(mem8[record + OBJ_X] + WRAP_MARGIN) >= X_LIMIT) return m.call(0x1fce);

  mem8[record + OBJ_ACTIVE] = 0;
  mem8[record + OBJ_X] = 0;
  return m.call(0x21ba);
}
