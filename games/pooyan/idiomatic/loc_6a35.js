// SPDX-License-Identifier: GPL-3.0-only
import { setActorAnimation } from "./setActorAnimation.js";
import {
  BLINK_COUNTDOWN,
  ANIM_PHASE_TOGGLE_892C,
  ANIM_PARAM_76D4,
  ANIM_PARAM_68EF,
  ANIM_PARAM_6B0A,
} from "./names.js";

const ACTIVE_BIT = 0x01; // record is live when bit 0 of (rec+0)|(rec+1) is set
const SPAWN_DELAY = 0x10; // spawn-delay countdown armed on every spawn
const PHASE1_DELAY = 0x1c; // countdown re-armed when the spawn phase is 1
const PHASE_MID = 0x02; // spawn phase selecting the mid animation pointer

/**
 * loc_6a35 — per-record enemy spawn/init (dissolved caller-skip).
 *
 * Returns true for a record that already carries the active bit, so the sweeping caller keeps
 * scanning. On the first empty record it activates and seeds the record's fields, arms the
 * spawn-delay countdown, then reads the phase toggle, bumps it, and picks a spawn animation
 * pointer by the pre-bump phase: 0 or 1 take the early pointer (phase 1 also re-arming the
 * countdown), 2 the mid pointer, higher the late pointer. It points the record at that
 * animation and returns false — telling the caller to abort, so one spawn happens per sweep.
 *
 * LIVE-OUT: none in registers. Memory: the seeded record fields and its animation cells, the
 * spawn-delay countdown, and the bumped phase toggle.
 */
export function loc_6a35(m, ix = m.regs.ix) {
  const { mem8 } = m;

  if (((mem8[ix] | mem8[ix + 1]) & ACTIVE_BIT) !== 0) return true; // already active -> keep sweeping

  // seed the freshly activated record's fields
  mem8[ix + 3] = 0x00;
  mem8[ix + 5] = 0x00;
  mem8[ix + 1] = 0x01; // active marker
  mem8[ix + 2] = 0x01;
  mem8[ix + 4] = 0x15;
  mem8[ix + 6] = 0x1e;
  mem8[ix + 9] = 0x28;
  mem8[BLINK_COUNTDOWN] = SPAWN_DELAY;

  const phase = mem8[ANIM_PHASE_TOGGLE_892C];
  mem8[ANIM_PHASE_TOGGLE_892C] = phase + 1; // bump the phase toggle

  let animPointer;
  if (phase === PHASE_MID) {
    animPointer = ANIM_PARAM_68EF;
  } else if (phase > PHASE_MID) {
    animPointer = ANIM_PARAM_6B0A;
  } else {
    if (phase !== 0) mem8[BLINK_COUNTDOWN] = PHASE1_DELAY; // phase 1 re-arms the countdown
    animPointer = ANIM_PARAM_76D4;
  }
  setActorAnimation(m, ix, animPointer);
  return false; // spawned -> caller aborts the sweep
}
