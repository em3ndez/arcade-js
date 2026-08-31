// SPDX-License-Identifier: GPL-3.0-only
import { dispatchPerFrameActorUpdatePasses } from "./dispatchPerFrameActorUpdatePasses.js";
import { driveEagleWavePerFrame } from "./driveEagleWavePerFrame.js";
/**
 * runWaveLaunchPhaseFrame — bonus-stage phase-1 body: run the shared per-frame world update, then
 * drive the eagle wave-launch machine.
 *
 * WHAT IT IS
 *   ROM 0x72a0-0x72a6. Grounding: [seen].
 *   A two-line sequencer with no logic of its own: it runs the shared per-frame update and then the
 *   eagle wave-launch driver, and returns the driver's result. Every branch, table and coordinate
 *   lives inside the two routines it invokes — this body only fixes their order and forwards the
 *   result.
 *
 * ROLE IN THE MACHINE
 *   The eagle bonus stage runs its own little wave pipeline, sequenced by an outer phase selector
 *   WAVE_OUTER_PHASE (0x8f38). Two "phase body" routines feed that pipeline, one per phase value.
 *   Phase 0 is the eagle/arrow *approach* frame (step the approach state machine, then the shared
 *   update). This routine is phase 1: the *wave-launch* frame. Where phase 0 runs its own machine
 *   before the shared update, phase 1 runs the shared update FIRST and the wave-launch driver
 *   second — so on a launch frame the moving world is advanced one beat before the launch driver
 *   decides what the eagle wave does next.
 *
 * THE TWO STEPS, IN ORDER
 *   1. Shared per-frame world update   (dispatchPerFrameActorUpdatePasses, 0x20d4)
 *   2. Eagle wave-launch driver        (driveEagleWavePerFrame, 0x72a7)
 *
 * LIVE-OUT (what it leaves behind)
 *   Memory only. This body writes no register itself; both effects land in RAM through the two
 *   routines it calls — the moving-world records/sprite list advanced by step 1, and the eagle-wave
 *   flags and records (WAVE_LAUNCH_FLAG 0x8f3a, WAVE_RECORD_COUNT 0x8f3c, WAVE_INDEX 0x8f3d, and the
 *   per-record state in ENEMY_ACTOR_TABLE 0x8ae0) touched by step 2. Step 2 runs as the routine's
 *   tail: whatever the wave driver returns is exactly what this routine hands back to its caller.
 */

export function runWaveLaunchPhaseFrame(m) {
  // STEP 1 — Advance the shared per-frame world update (0x20d4).
  // The same gated update pass that every gameplay and bonus frame runs: it gates the per-object
  // update and then runs a fixed chain of per-frame helpers that step the moving objects and enemy
  // actors and restage the sprite display list. On this launch frame it runs first, so the object
  // world is current for one beat before the wave-launch driver acts on it below.
  dispatchPerFrameActorUpdatePasses(m); //      shared per-frame update
  // STEP 2 — Drive the eagle wave-launch machine (0x72a7), and return its result.
  // A three-way fork on two flags: with the launch flag WAVE_LAUNCH_FLAG (0x8f3a) clear it seeds
  // the next eagle wave and returns; with the live-record count WAVE_RECORD_COUNT (0x8f3c) zero it
  // hands off to the inter-wave idle handler; otherwise it walks the wave's live records — two per
  // wave index WAVE_INDEX (0x8f3d), in ENEMY_ACTOR_TABLE (0x8ae0) — through the per-record state
  // dispatcher, one record per frame. This is the routine's tail step, so its return value becomes
  // this routine's return value.
  return driveEagleWavePerFrame(m); // wave-launch driver
}
