// SPDX-License-Identifier: GPL-3.0-only
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { OBJECT_DRAWN_FLAG } from "./names.js";

/**
 * loc_76a6 — animation-tick state 2 (the "drawn / steady" state).  ROM 0x76a6.  [seen]
 *
 * WHAT IT IS
 *   One of the three per-record states of the enemy-pool animation-tick machine. Every enemy record
 *   in the pool carries a small state byte, and once per frame a sweep visits each active record and
 *   runs whichever of the three ticks that state byte selects:
 *     - state 0 advances the record's sub-position and rolls its frame counter, and on the sixth
 *       frame it flips the whole group over to state 1;
 *     - state 1 drains a shared phase countdown (SHARED_PHASE_COUNTDOWN, 0x892e) and, when it
 *       lapses, re-seeds the group into state 2 for the next display phase;
 *     - state 2 is THIS handler: the object is placed and settled, so it simply cycles its own
 *       animation frames.
 *
 * ROLE IN THE MACHINE
 *   State 2 is a gate keyed on OBJECT_DRAWN_FLAG (0x8d58), the pool-wide one-shot that stands
 *   whenever an object has been drawn. While that flag is set this tick HOLDS: the record keeps the
 *   picture it is already showing and its animation does not step. Tying the step to the drawn flag
 *   keeps the pool's animation marching in lockstep with the draw cadence instead of racing ahead of
 *   it. Only when the flag is clear does the record's animation program advance one frame's worth of
 *   time.
 *
 *   Unlike states 0 and 1 — each of which can cut the per-frame sweep short when it re-seeds the
 *   group — state 2 never interrupts the sweep. Whether it holds or steps, it lets the walk carry on
 *   to the next record.
 *
 * GROUNDING: [seen].
 *
 * LIVE-OUT: no register result — this handler always tells the sweep to keep going. In memory it
 *   touches nothing while the gate is closed; while the gate is open the only change is this record's
 *   advanced animation (its frame-hold counter, and on a hold expiry the freshly loaded
 *   tile / colour / hold plus the stepped animation-script pointer), all held inside the record at ix.
 */
export function loc_76a6(m, ix = m.regs.ix) {
  const { mem8 } = m;

  // GATE — OBJECT_DRAWN_FLAG (0x8d58) is the pool-wide "a draw is outstanding" one-shot. While it is
  // non-zero the object stays on the frame it is already showing: hold, advance nothing, and let the
  // sweep move on to the next record.
  if (mem8[OBJECT_DRAWN_FLAG] !== 0) return true; // gate closed -> hold this record's picture

  // GATE OPEN — no draw is pending, so step this record's own animation by one frame: count down its
  // frame-hold and, when that expires, pull the next {tile, colour, hold} entry from its animation
  // script. Every one of those fields lives inside the record addressed by ix.
  advanceObjectAnimationFrame(m, ix); // gate open -> step this entry's animation one frame

  // State 2 never cuts the sweep short — tell it to continue on to the next record.
  return true;
}
