// SPDX-License-Identifier: GPL-3.0-only
import { setActorAnimation } from "./setActorAnimation.js";
import { ANIM_TABLE_3838 } from "./names.js";

/**
 * advanceActorStateOnTimerAndRestartAnim — hold an actor in its current phase for a fixed
 * number of frames, then kick it into the next phase and give it a new look. [seen]
 * (ROM 0x125f–0x126f)
 *
 * WHAT IT IS
 * Every moving thing the game tracks — a hunter riding a rope, a spawned prize, a struck or
 * falling object — is an ACTOR RECORD, a fixed-layout block of bytes in work RAM whose base
 * address arrives in the record pointer (rec). One byte of that record, the PHASE FIELD at
 * +0x02, says which behaviour the actor is currently running; a companion timer at +0x11
 * counts down the frames the actor should stay in that phase before moving on.
 *
 * ITS ROLE IN THE MACHINE
 * This is the handler for PHASE 0 — the first, "just-arrived / settling" phase — inside the
 * per-actor state machine (the dispatcher walks the actor array once per frame and calls the
 * handler picked by the low bits of the phase field, so this routine runs on every actor that
 * currently sits in phase 0). Its whole job is a timed transition: burn one frame off the
 * per-phase timer, and when that timer runs out, promote the actor to the next phase, raise a
 * one-frame "just advanced" latch for whatever runs next, and restart its animation on the
 * shared descent/settle sequence so the new phase begins with a fresh look.
 *
 * Because the phase field it bumps (+0x02) is the very byte the dispatcher reads to choose a
 * handler, incrementing it is what hands the actor off: next frame the dispatcher will select
 * phase 1's handler instead of this one.
 *
 * GROUNDING: [seen].
 *
 * LIVE-OUT: memory only.
 *   • The per-phase timer at rec+0x11 is decremented every call.
 *   • On the frame the timer hits zero it also writes: the phase field rec+0x02 (bumped by one),
 *     the advance latch rec+0x08 (set to 1), and the record's animation fields (rec+0x0c..0x0e,
 *     retargeted at ANIM_TABLE_3838 and rewound to frame 0 by setActorAnimation).
 * No load-bearing register output — the actor is addressed entirely through rec.
 */

// Byte offsets into the actor record, measured from its base (rec).
const PHASE_TIMER = 0x11; // per-phase countdown timer: frames left before this phase advances
const PHASE_FIELD = 0x02; // phase field, advanced on expiry (also the byte the dispatcher reads)
const ADVANCE_LATCH = 0x08; // one-frame "phase just advanced" flag, set to 1 on the advance

export function advanceActorStateOnTimerAndRestartAnim(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // STEP 1 — tick the per-phase dwell timer (rec+0x11) down by one frame, and if it has not yet
  // reached zero, leave the actor exactly where it is: still in this phase, everything else
  // untouched. This is the "stay put for N frames" body of the phase — the common path, taken on
  // every frame but the last of the dwell.
  mem8[rec + PHASE_TIMER] = mem8[rec + PHASE_TIMER] - 1;
  if (mem8[rec + PHASE_TIMER] !== 0) return;

  // STEP 2 — the timer has expired: promote the actor to its next phase by bumping the phase field
  // (rec+0x02). Since the dispatcher chooses each actor's handler from this same byte, the bump is
  // the hand-off — from the next frame on, a different phase handler will run on this record.
  mem8[rec + PHASE_FIELD] = mem8[rec + PHASE_FIELD] + 1;

  // STEP 3 — raise the advance latch (rec+0x08). This is a one-frame signal that a phase boundary
  // was just crossed, read by the behaviour that takes over so it can do its once-per-transition
  // setup rather than repeating it every frame.
  mem8[rec + ADVANCE_LATCH] = 1;

  // STEP 4 — give the new phase a fresh look: point the record's animation fields at the shared
  // descent/settle sequence (ANIM_TABLE_3838, a 4-frame table in ROM) and rewind it to frame 0, so
  // the incoming phase starts its animation from the top instead of inheriting the old frame index.
  setActorAnimation(m, rec, ANIM_TABLE_3838);
}
