// SPDX-License-Identifier: GPL-3.0-only
/**
 * handlePlayerHitEvent — consume the player-death event and kick off its aftermath.
 *
 * WHAT IT IS
 *   The sole consumer of HIT_EVENT_FLAG (0x4204), the player-death event raised by the enemy
 *   collision tests (flagProjectileHitOnPlayer 0x0b8d and flagObjectHitOnPlayer 0x12b6) when a
 *   shot or object overlaps the ship (mechanisms.md "HIT_EVENT_FLAG is the player-death event").
 *   Called each frame from the play pipeline runGameplayFrameAndAdvanceOnFieldClear; if the flag
 *   is clear it is a no-op, otherwise it drains the flag and stages the death.
 *
 * ROLE IN THE MACHINE
 *   Its single clear of OBJ_ACTIVE_FLAG (0x4200) freezes the entire object/AI/projectile
 *   subsystem — quieting every gated routine until the next life begins. It also sets loc_4201,
 *   the enable that both tips moveControlledObjectAndStageSprite into its death-pose branch and
 *   arms the hit-sound step sequence driveGatedSoundStepSequence (0x1327), which counts down the
 *   exact pulse-counter pair (loc_4205=10, loc_4206=4) this routine loads.
 *
 * ROM 0x12ed.  Grounding: [seen].
 *
 * LIVE-OUT: HIT_EVENT_FLAG=0; OBJ_ACTIVE_FLAG=0; loc_4201=1; loc_4205=10; loc_4206=4; a hit-sound
 * command (2,5) queued; loc_421a decremented (floored 0); loc_421d stepped in [0,5]; and
 * SOUND_W_REG3 (0x6803) pulsed to 1 when mode flag loc_4006 bit0 is set.
 */
import {
  HIT_EVENT_FLAG, OBJ_ACTIVE_FLAG, loc_4201, loc_4205, loc_4206,
  loc_421a, loc_421d, loc_4006, SOUND_W_REG3,
} from "./names.js";
import { enqueueCommandWord } from "./enqueueCommandWord.js";

export function handlePlayerHitEvent(m) {
  const { mem8 } = m;

  if ((mem8[HIT_EVENT_FLAG] & 0x01) === 0) return; // no event pending

  // Drain the event, then freeze the object subsystem (OBJ_ACTIVE_FLAG=0) and light the death
  // enable loc_4201=1 and its pulse counters. loc_4205/loc_4206 are the (10, 4) pair the hit-sound
  // step sequence ticks down; enqueueCommandWord((2,5)) posts the hit sound onto the command queue.
  mem8[HIT_EVENT_FLAG] = 0;
  mem8[OBJ_ACTIVE_FLAG] = 0;   // reset the object-active pair
  mem8[loc_4201] = 1;
  mem8[loc_4205] = 10;         // arm the two pulse counters
  mem8[loc_4206] = 4;
  enqueueCommandWord(m, (2 << 8) | 5); // queue the hit sound command

  // Ease the launch pacing after a death: loc_421a is the 0..7 pace counter, nudged down one (but
  // never below 0) so the next wave of divers trickles out a touch slower.
  if (mem8[loc_421a] !== 0) mem8[loc_421a] = mem8[loc_421a] - 1; // activity countdown, floored at 0

  // Advance the [0,5] cycle counter loc_421d one step, wrapping 0 back to 5 (a 6-state rotor). The
  // Z80 dec underflows 0 to 0xff, so the >= 6 clamp folds that back into the legal 5.
  let cycle = (mem8[loc_421d] - 1) & 0xff; // step the [0,5] cycle counter, wrapping past 0 back to 5
  if (cycle >= 6) cycle = 5;
  mem8[loc_421d] = cycle;

  if (mem8[loc_4006] & 0x01) mem8[SOUND_W_REG3] = 1; // pulse the sound latch when the mode bit is set
}
