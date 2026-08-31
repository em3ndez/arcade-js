// SPDX-License-Identifier: GPL-3.0-only
import { u8 } from "../../../core/int.js";
import { queueSoundRun26 } from "./queueSoundRun26.js";
import { queueSoundCommands95And03And11 } from "./queueSoundCommands95And03And11.js";
import { deriveStackedSpriteYs } from "./deriveStackedSpriteYs.js";
import { findTableSlotAndPaintStageHeader } from "./findTableSlotAndPaintStageHeader.js";
import {
  WAVE_TEARDOWN_STATE,
  WAVE_EVENT_LATCH,
  PERIODIC_EVENT_TIMER,
  PLAYER_Y,
  GRAB_ACTIVE_FLAG,
  ATTRACT_FIELD_ATTRIB_SRC,
  loc_8083,
} from "./names.js";
/**
 * advanceWaveTeardownByState -- the shared epilogue that dismantles a finished attack wave and then
 * lowers the boss, run once per frame as the tail of the hunter-formation dispatch. Everything it
 * does is keyed on a single teardown-state byte, WAVE_TEARDOWN_STATE (0x8f24), that counts the wave
 * through its shutdown. While that byte is nonzero the rest of the machine treats the board as
 * "busy" and refuses to arm new rope grabs or launches, so this routine both performs the teardown
 * and, by stepping the state, decides how long the board stays locked.
 *
 * WHAT IT IS -- a three-way branch on WAVE_TEARDOWN_STATE (0x8f24):
 *   state 0            idle -- nothing to tear down; return immediately.
 *   state 1            dismantle the wave -- clear the periodic siren scheduling, kick the teardown
 *                      sound, step to state 2, then run a ROM self-check whose corrupted result
 *                      diverts into the stage-header repaint.
 *   state 2            lower the boss -- nudge the boss actor down two rows per frame until it
 *                      reaches the floor, then play the completion jingle and, unless already
 *                      finished, mark the sequence done and step to state 3.
 *   state 3 and above  settled -- teardown already complete; return.
 *
 * ROLE IN THE MACHINE: an attack wave ends by having the game walk WAVE_TEARDOWN_STATE 1 -> 2 -> 3.
 * State 1 is a single bookkeeping frame; state 2 holds for as many frames as the boss takes to
 * descend; state 3 is the settled "torn down" resting value. Other subsystems read this byte to
 * learn a teardown is in flight and hold off spawning while it is.
 *
 * ROM ADDRESS: 0x32bd-0x3306.
 * Grounding: [seen]
 *
 * LIVE-OUT (what it leaves in memory):
 *   WAVE_TEARDOWN_STATE  (0x8f24) -- stepped 1->2 (state 1) or 2->3 (state 2, on completion)
 *   WAVE_EVENT_LATCH     (0x8d21) -- cleared to 0 (state 1)
 *   PERIODIC_EVENT_TIMER (0x8d22) -- reloaded to 0x20 (state 1)
 *   PLAYER_Y             (0x8a84) -- boss vertical position, advanced +2 per frame (state 2)
 *   GRAB_ACTIVE_FLAG     (0x8d32) -- raised to 1 once the boss reaches the floor (state 2)
 *   plus the sound-command ring, and -- only on a self-check mismatch -- the stage-header tiles.
 */

const BOSS_DESCENT_LIMIT = 0xdb; // boss floor position: at/above this the descent is complete
const DESCENT_STEP = 2; //            rows the boss position advances each frame
const PERIODIC_TIMER_RESEED = 0x20; // reload value written to the periodic-event timer (0x8d22)
const CKSUM_LEN = 0x20; //            number of bytes summed by the ROM integrity self-check
const TAMPER_MASK = 0x47; //          a nonzero sum & this mask means a tampered ROM -> divert

export function advanceWaveTeardownByState(m) {
  const { mem8 } = m;

  // The teardown-state byte WAVE_TEARDOWN_STATE (0x8f24) drives the whole routine.
  const state = mem8[WAVE_TEARDOWN_STATE];
  if (state === 0) return; // state 0: no teardown in progress -- nothing to do

  if (state === 2) {
    // ===== state 2: lower the boss to the floor =====
    // The boss descends through the lead-actor vertical-position cell PLAYER_Y (0x8a84). Each frame
    // it drops DESCENT_STEP (2) rows; while it is still above the floor limit the stacked sprite Ys
    // are re-derived so the on-screen boss tracks the moving position, and the routine returns to
    // wait for the next frame. Once it reaches the floor the completion handling below runs.
    mem8[PLAYER_Y] = mem8[PLAYER_Y] + DESCENT_STEP; // drop the boss two rows this frame
    if (mem8[PLAYER_Y] < BOSS_DESCENT_LIMIT) {
      deriveStackedSpriteYs(m); // still above the floor: refresh the boss's stacked sprite Ys
      return;
    }
    queueSoundCommands95And03And11(m); // reached the floor: play the completion jingle (0x95/0x03/0x11)
    if (mem8[loc_8083] !== 0) return; // completion gate (0x8083) already nonzero -> already finished
    mem8[GRAB_ACTIVE_FLAG] = mem8[loc_8083] + 1; // gate byte is 0, so store 1 into the busy latch (0x8d32)
    mem8[WAVE_TEARDOWN_STATE] = mem8[WAVE_TEARDOWN_STATE] + 1; // step 2 -> 3 (teardown finished)
    return;
  }

  if (state >= 3) return; // state 3 and above: teardown already settled -- return

  // ===== state 1: dismantle the wave =====
  // The one-frame bookkeeping step: shut the wave's periodic siren scheduling down, kick the
  // teardown sound, step to state 2 (the boss descent), then run the ROM integrity self-check.
  mem8[WAVE_EVENT_LATCH] = 0; // clear the periodic-event latch (0x8d21): silences the siren trigger
  mem8[PERIODIC_EVENT_TIMER] = PERIODIC_TIMER_RESEED; // reload the periodic-event timer (0x8d22) to 0x20
  queueSoundRun26(m); // kick the teardown sound run (opens with sound command 0x26)
  mem8[WAVE_TEARDOWN_STATE] = mem8[WAVE_TEARDOWN_STATE] + 1; // step 1 -> 2 (into the boss descent)

  // ROM integrity self-check: sum CKSUM_LEN (0x20) bytes of the attract field-attribute source table
  // ATTRACT_FIELD_ATTRIB_SRC (ROM 0x0779), 8-bit wrapping. On an intact ROM the masked sum is zero
  // and the routine just returns; a nonzero mask means the ROM has been tampered with.
  let sum = 0;
  for (let i = 0; i < CKSUM_LEN; i++) sum = u8(sum + mem8[ATTRACT_FIELD_ATTRIB_SRC + i]); // wrapping byte sum
  if ((sum & TAMPER_MASK) !== 0) {
    // Tampered: divert into the stage-header path instead of returning, entered with the masked
    // result, a pointer just past the checked block (ATTRACT_FIELD_ATTRIB_SRC + CKSUM_LEN = 0x0799),
    // and the full running sum -- the state findTableSlotAndPaintStageHeader expects.
    return findTableSlotAndPaintStageHeader(m, sum & TAMPER_MASK, ATTRACT_FIELD_ATTRIB_SRC + CKSUM_LEN, 0, sum);
  }
}
