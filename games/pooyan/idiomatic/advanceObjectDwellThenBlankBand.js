// SPDX-License-Identifier: GPL-3.0-only
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { blankActorSpriteBand } from "./blankActorSpriteBand.js";
/**
 * advanceObjectDwellThenBlankBand — animate an on-screen object, hold it for a fixed dwell, then
 * make it vanish when the dwell runs out.
 *
 * WHAT IT IS
 *   ROM 0x416f-0x4178. Grounding: [seen].
 *
 *   Every moving thing in the game — enemies, the eagle, thrown objects, and the rest — is kept as
 *   a fixed-stride "actor record" in work RAM, and each record carries a small state byte that
 *   selects which per-frame behaviour handler runs for it this frame. This routine is one of those
 *   handlers: the "linger, then disappear" step. It is what an object runs during the brief window
 *   between finishing its useful life and being erased from the screen — a hit enemy that plays a
 *   short death/settle animation before it is cleared, for example. The object keeps animating in
 *   place for a set number of frames, and the instant that budget expires it is blanked out.
 *
 * ROLE IN THE MACHINE
 *   Reached through the per-object state dispatch, one frame at a time, for whichever record is
 *   currently selected (its address is handed in through the index pointer). It sits at the end of
 *   an object's lifecycle: hold the last picture for a moment, then hand off to the routine that
 *   removes the sprite. It draws nothing itself and makes no decisions beyond "is the dwell up
 *   yet?" — the animation and the erase are each delegated to a dedicated primitive.
 *
 * HOW IT WORKS
 *   1. Advance the object's animation by one frame (its picture may change or simply hold).
 *   2. Decrement the object's dwell countdown, a per-state timer living at record byte +0x11 that
 *      is distinct from the finer per-picture frame-hold the animation sequencer manages inside
 *      the record. While the dwell is still non-zero the object lingers and the handler returns,
 *      so it will be re-entered next frame to count down again.
 *   3. When the dwell reaches zero the object's time on screen is over: tail into the sprite-band
 *      blank, which zeroes the record's drawing bytes so the sprite stops being drawn next frame.
 *
 * LIVE-OUT: none of its own — this is a table-dispatched per-frame step and the whole result lives
 * in the object's record in memory: either the ticked animation and decremented dwell (still
 * lingering), or, on expiry, the record's sprite band zeroed so the object disappears.
 */
const DWELL_FIELD = 0x11; // per-state dwell countdown in the actor record (byte +0x11)

export function advanceObjectDwellThenBlankBand(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Step 1 — animate. Advance this object's own animation program by one frame's worth of time:
  // the shared per-object sequencer either counts down the current picture's frame-hold, or, when
  // that hold has lapsed, walks the record's animation script to the next tile/attribute/hold
  // entry. Everything it does stays inside this record.
  advanceObjectAnimationFrame(m, rec); // advance the object's animation

  // Step 2 — tick the dwell. Byte +0x11 of the record is the object's dwell budget: how many more
  // frames it should linger in this state before being removed. Spend one frame of that budget.
  mem8[rec + DWELL_FIELD] = mem8[rec + DWELL_FIELD] - 1;
  // If any dwell remains, the object is still lingering — leave it on screen and return so this
  // handler runs again next frame to count down further.
  if (mem8[rec + DWELL_FIELD] !== 0) return; // still dwelling this frame

  // Step 3 — expire. The dwell has reached zero, so the object's time is up: hand off to the
  // sprite-band blank, which zeroes the record's leading drawing bytes and makes the sprite vanish
  // from the next frame's output. This closes the object's lifecycle in the same frame the dwell
  // lapsed.
  return blankActorSpriteBand(m, rec); // dwell elapsed: tail into the next-state band blank
}
