// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { advanceEnemyAnimationPhase } from "./advanceEnemyAnimationPhase.js";
import { loc_8d45, OBJECT_STATE8_ANIM_TABLE, OBJECT_ANIM_DISPLAY_CMD_BASE } from "./names.js";
/**
 * armEnemyState8Animation — object state-8 handler.
 *
 * WHAT IT IS
 *   ROM 0x3d18. One of the seventeen per-record sub-state handlers that the object-state
 *   dispatcher routes each active enemy/object record to every frame (index 8). It runs once,
 *   at the moment a record enters state 8: it selects the animation this object should now play,
 *   arms the frame timer that paces it, points the record at the chosen animation sequence, and
 *   bumps the record on to the next state so the following frame lands in state 9.
 *
 * ROLE IN THE MACHINE
 *   The animation the object plays here is picked from three inputs:
 *     - the difficulty/level selector byte at loc_8d45 (0x8d45): 0 means the plain path, nonzero
 *       selects the harder animation set and, on the harder path, also queues a display command;
 *     - the record's own base animation index (rec+0x17) and child index (rec+0x12);
 *     - the direction bit (rec+0x07 bit 1), which chooses the mirrored/turned variant.
 *   The record is passed in IX (here `rec`). Field offsets used:
 *     rec+0x02 sub-state byte, rec+0x07 flags (bit 1 = facing/direction), rec+0x11 frame timer,
 *     rec+0x12 child index, rec+0x17 base animation index.
 *
 * GROUNDING: [seen]
 *
 * LIVE-OUT: none directly — it writes the frame timer (rec+0x11), the animation sequence pointer
 *   (via setActorAnimation), and the advanced sub-state (rec+0x02), then hands its return value
 *   to the state-9 handler advanceEnemyAnimationPhase, which it runs immediately (the ROM falls
 *   through from 0x3d5b straight into 0x3d5c).
 */

// The clamp ceiling for the difficulty term: difficulties above 3 all fold to 3 before use,
// so the animation-set offset (difficulty + 6) tops out at 9.
const DIFF_CLAMP = 3;
// Frame-timer reseed on the harder (difficulty-active) animation path (rec+0x11).
const TIMER_RESEED_ANIM = 0x38;
// Frame-timer reseed on the plain/idle path (rec+0x11).
const TIMER_RESEED_IDLE = 0x20;
// Direction/facing bit within the record flags byte (rec+0x07): set = mirrored/turned variant.
const DIR_BIT = 0x02;

export function armEnemyState8Animation(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Step 1 — seed the defaults. Assume the plain path: idle-speed frame timer, and the animation
  // index taken straight from the record's stored base index (rec+0x17). The difficulty test below
  // may override both.
  let timerReseed = TIMER_RESEED_IDLE;
  let animIndex = mem8[u16(rec + 0x17)];
  // Read the difficulty/level selector (0x8d45). Zero leaves the plain path in place; nonzero opens
  // the harder animation set.
  const difficulty = mem8[loc_8d45];
  if (difficulty !== 0) {
    // Step 2 — difficulty-active path. Read the record's child index (rec+0x12) and add one. The ROM
    // uses inc-then-branch: a stored 0xff (no child / sentinel) wraps to 0 and is treated specially.
    const child = (mem8[u16(rec + 0x12)] + 1) & 0xff;
    if (child === 0) {
      animIndex = 0; // child index was 0xff
    } else {
      // A real child exists on the hard path: pick from the harder animation set. The index is the
      // difficulty clamped to DIFF_CLAMP plus a fixed base of 6 (giving 7..9), and a display command
      // is queued for it — OBJECT_ANIM_DISPLAY_CMD_BASE (0x030f, a type-0x03 command word) offset by
      // that same index, dropped into the page-0x88 display-command ring. This path also runs the
      // animation faster, so the frame timer reseeds to the shorter TIMER_RESEED_ANIM.
      animIndex = (Math.min(difficulty, DIFF_CLAMP) + 6) & 0xff;
      enqueueDisplayCommand(m, OBJECT_ANIM_DISPLAY_CMD_BASE + animIndex);
      timerReseed = TIMER_RESEED_ANIM;
    }
  }
  // Step 3 — arm the frame timer (rec+0x11) with the reseed chosen above; the per-frame state-9
  // handler counts this down to pace the animation.
  mem8[u16(rec + 0x11)] = timerReseed;

  // Step 4 — apply the facing/direction adjustment (rec+0x07 bit 1). With the bit clear the base
  // index is used as-is. With it set, step to the next table entry (+1) for the turned variant; and
  // when difficulty is active, skip a further 3 entries so the turned variant lands in the harder
  // animation block. (Difficulty is re-read here rather than cached, mirroring the ROM.)
  let index = animIndex;
  if (mem8[u16(rec + 0x07)] & DIR_BIT) {
    const stepped = (animIndex + 1) & 0xff;
    index = mem8[loc_8d45] !== 0 ? (stepped + 3) & 0xff : stepped;
  }
  // Step 5 — install the animation. Look up the little-endian animation-sequence pointer from the
  // object state-8 animation table (OBJECT_STATE8_ANIM_TABLE, ROM 0x3dd3) at the computed index, and
  // point the record at that sequence, restarting it.
  setActorAnimation(m, rec, fetchWordFromTableIndex(m, index, OBJECT_STATE8_ANIM_TABLE));

  // Step 6 — advance the record's sub-state (rec+0x02) by one, so subsequent frames run state 9.
  const stateCell = u16(rec + 0x02);
  mem8[stateCell] = mem8[stateCell] + 1; // advance the object state
  // Step 7 — the ROM falls straight through from the end of state 8 (0x3d5b) into the state-9 handler
  // at 0x3d5c, running it this same frame and returning whatever it returns.
  return advanceEnemyAnimationPhase(m, rec); // fall through into the state-9 handler
}
