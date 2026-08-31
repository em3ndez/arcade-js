// SPDX-License-Identifier: GPL-3.0-only
import { runPhase1LauncherThenDriver } from "./runPhase1LauncherThenDriver.js";
import { sampleJoystickIntoPlayerAimState } from "./sampleJoystickIntoPlayerAimState.js";
import { dispatchPerFrameActorUpdatePasses } from "./dispatchPerFrameActorUpdatePasses.js";
import { rebuildSpriteDisplayList } from "./rebuildSpriteDisplayList.js";
import { advanceBonusAwardQueueAndBumpGauge } from "./advanceBonusAwardQueueAndBumpGauge.js";
import { pickEnemyGroupSpeedAndClearAim } from "./pickEnemyGroupSpeedAndClearAim.js";
import { scanActorCollisionsBothSlots } from "./scanActorCollisionsBothSlots.js";
import { drainSoundCommandRing } from "./drainSoundCommandRing.js";
import { tickHudRefresh } from "./tickHudRefresh.js";

/**
 * runLevelIntroPhase1Frame — the level-intro phase-1 per-frame body: nine subsystem updates run
 * in one fixed order, every frame.
 *
 * WHAT IT IS
 *   ROM 0x6e59-0x6e74. Grounding: [seen].
 *   A straight-line sequencer with no branching or arithmetic of its own — nine calls, then a
 *   return. Each call is a whole subsystem update (HUD, spawn, input, object world, sprites, bonus
 *   tally, enemy speed, collisions, sound); this body contributes only the *order* they run in.
 *   Every flag, table and coordinate lives inside the nine routines it invokes.
 *
 * ROLE IN THE MACHINE
 *   On rounds that take the deep path, the per-frame fork hands the frame to the level-intro phase
 *   dispatcher `dispatchLevelIntroPhase` (0x6da6), which selects among the intro-phase bodies. This
 *   is the phase-1 body: the frame that runs while the level-intro build-up is playing out. It is a
 *   sibling of the active-play worker chain (`runActivePlayFrame`) and the bonus-stage phase bodies
 *   — same idea, a fixed straight-line sequence of subsystem passes that IS the frame — but it wires
 *   a phase-specific mix: the phase-1 spawner, a joystick→aim sampler, a pending-bonus tally step,
 *   an enemy-group speed pick, and a two-pass collision driver, in place of the active-play set.
 *   When it returns, control unwinds back out through the phase dispatcher to its caller.
 *
 * THE NINE STEPS, IN ORDER
 *   1. HUD-refresh tick                     (tickHudRefresh, 0x1583)
 *   2. phase-1 spawner gate                 (runPhase1LauncherThenDriver, 0x6e75)
 *   3. joystick → player-aim sampler        (sampleJoystickIntoPlayerAimState, 0x1e55)
 *   4. per-frame object-update pass          (dispatchPerFrameActorUpdatePasses, 0x20d4)
 *   5. sprite display-list rebuild           (rebuildSpriteDisplayList, 0x02ef)
 *   6. pending bonus-award tally step        (advanceBonusAwardQueueAndBumpGauge, 0x18da)
 *   7. enemy-group speed pick + aim clear    (pickEnemyGroupSpeedAndClearAim, 0x191c)
 *   8. two-pass actor collision scan         (scanActorCollisionsBothSlots, 0x6404)
 *   9. one sound-command-ring drain          (drainSoundCommandRing, 0x0e64)
 *
 * LIVE-OUT: none — a void driver. This body writes no register and returns nothing; every effect is
 *   a side effect in shared memory left by one of the nine callees.
 */
export function runLevelIntroPhase1Frame(m) {
  // STEP 1 — HUD-refresh tick (0x1583).
  // The per-frame HUD refresh, run first so the score/credit/round display is current before any
  // game logic touches it this frame. It carries a tamper-gated gameplay dispatch: when the
  // anti-tamper tally is set, the guarded work is skipped, so a modified ROM degrades quietly here.
  tickHudRefresh(m);
  // STEP 2 — Phase-1 spawner gate (0x6e75).
  // The intro-phase object launcher. With neither guard flag set it runs the single-object launcher
  // and then the per-record driver that steps the intro's spawned objects. If either the anti-tamper
  // tally or the signature-mismatch flag SIGNATURE_MISMATCH_FLAG (0x8ef0) is set it takes the
  // skip-spawn branch (a dead trap that points into data, never reached with a valid ROM), so on an
  // intact board this always runs the spawn/drive pair. This is the pass unique to the phase-1 frame.
  runPhase1LauncherThenDriver(m);
  // STEP 3 — Joystick → player-aim sampler (0x1e55).
  // Reads the joystick into the player-actor state byte. Abort/freeze flags zero the byte; otherwise
  // it stores the complemented joystick and rotates its bit 4 through a shift latch that gates
  // clearing bit 4 of the state byte — the per-frame input read that steers the player's aim.
  sampleJoystickIntoPlayerAimState(m);
  // STEP 4 — Per-frame object-update pass (0x20d4).
  // The shared moving-world update: a per-object update gate followed by the fixed helper chain that
  // advances the moving objects and enemy actors. The same pass every gameplay and bonus frame runs;
  // here it steps the intro's world for one beat before the display list is rebuilt below.
  dispatchPerFrameActorUpdatePasses(m);
  // STEP 5 — Sprite display-list rebuild (0x02ef).
  // Restages the sprite display list from the now-current object state: four record groups, then the
  // arrow's Y-tick, then a flip-mirror tail. Run after the world update so the frame the hardware
  // shows reflects this frame's object positions.
  rebuildSpriteDisplayList(m);
  // STEP 6 — Pending bonus-award tally step (0x18da).
  // Advances the pending bonus-award queue: reload the award queue when it is empty, else gate on the
  // active player's score MSB equalling the queued value, bump the saturating gauge, BCD-step the
  // queue, render the gauge, and append the tally sound. This is how an earned bonus is paid out and
  // shown a step at a time across frames.
  advanceBonusAwardQueueAndBumpGauge(m);
  // STEP 7 — Enemy-group speed pick + aim clear (0x191c).
  // For a newly targeted enemy group (gated), chooses the group's speed/column value, commits it to
  // the speed index, and clears the player aim flags plus the two adjacent cells — resetting the aim
  // state as a fresh group's motion parameters are locked in.
  pickEnemyGroupSpeedAndClearAim(m);
  // STEP 8 — Two-pass actor collision scan (0x6404).
  // The collision driver, guarded by PLAY_MODE_LATCH / ROUND_COUNTER bit 0. It scans the actor record
  // twice (selector 0, then selector 4), aborting on a collision — the record terminator skip inside
  // the scan unwinds the rest of this frame's collision work when a hit is found.
  scanActorCollisionsBothSlots(m);
  // STEP 9 — Drain one sound-command from the ring (0x0e64).
  // Takes one entry from the sound-command ring buffer and dispatches it to the audio CPU (gated by
  // the demo-sounds / game-active flags), then frees the slot and advances the head. This is the
  // frame's *second* drain — the top-level per-frame service already drained the ring once — so during
  // the phase-1 intro frame the ring can give up more than one command, letting queued sounds keep
  // pace. Sound is drained last so it reflects everything this frame just did.
  drainSoundCommandRing(m);
}
