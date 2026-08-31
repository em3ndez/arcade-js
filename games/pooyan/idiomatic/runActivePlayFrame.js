// SPDX-License-Identifier: GPL-3.0-only
import { tickHudRefresh } from "./tickHudRefresh.js";
import { generatePlayerControlInput } from "./generatePlayerControlInput.js";
import { advanceToPhaseCompleteOnStageEnd } from "./advanceToPhaseCompleteOnStageEnd.js";
import { dispatchPerFrameActorUpdatePasses } from "./dispatchPerFrameActorUpdatePasses.js";
import { serviceEnemySpawns } from "./serviceEnemySpawns.js";
import { stepEnemyActorStates } from "./stepEnemyActorStates.js";
import { dispatchFormationObjectStates } from "./dispatchFormationObjectStates.js";
import { rebuildSpriteDisplayList } from "./rebuildSpriteDisplayList.js";
import { runActorUpdatePipeline } from "./runActorUpdatePipeline.js";
import { drainSoundCommandRing } from "./drainSoundCommandRing.js";

/**
 * runActivePlayFrame — the active-play frame handler.
 *
 * WHAT IT IS
 *   One beat of the machine while a wave is actually being played. Pooyan drives its
 *   frame through nested selectors: the top-level MAIN_GAME_STATE (0x8805) picks the
 *   live-play branch, and under that a *main-loop sub-state machine* selects the shape
 *   of the current play beat. That inner selector is MAINLOOP_SUBSTATE_SELECTOR
 *   (0x8f5c); dispatchMainLoopSubstate masks it (&7) and jumps through the six-entry
 *   inline word table at ROM 0x0fe3 to one of six handlers. This routine is state 1 of
 *   that table — the handler for a frame in which a wave is up and being fought.
 *
 * ROLE IN THE MACHINE
 *   It is the conductor of the active-play frame: a fixed, straight-line ordering of
 *   the ten subsystem updates that together advance one frame of live gameplay. Nothing
 *   here computes; every line hands the whole machine state to one subsystem and lets it
 *   read and mutate shared work RAM. The *order* is the contract — HUD first, then input,
 *   then the stage-end gate, then the object/enemy/formation world, then the sprite list,
 *   the actor pipeline, and finally one queued sound. A wrong order would let a subsystem
 *   act on stale state (e.g. building the sprite list before the actors have moved).
 *
 * ROM ADDRESS
 *   0x1016-0x1034 (reached as state 1 of the 0x0fe3 dispatch table).
 *
 * Grounding: [seen]
 *
 * LIVE-OUT
 *   Memory only. This routine leaves nothing in a register; every observable effect is a
 *   side effect written to shared work RAM (and the sprite banks / audio latch) by the ten
 *   subsystems it invokes, in the order below.
 */

export function runActivePlayFrame(m) {
  // Step 1 — HUD refresh tick (tickHudRefresh, ROM 0x1583).
  // Keeps the on-screen HUD current on a 16-frame cadence: it counts frames in its own
  // counter at 0x8f4d and, on every sixteenth frame, enqueues a display command so the
  // score/round/credit cells get repainted. Run first so the panel reflects the state the
  // rest of the frame is about to change.
  tickHudRefresh(m);

  // Step 2 — read the player's controls (generatePlayerControlInput, ROM 0x1042).
  // Samples the input port and folds it into the lead actor's (slot 0) control byte at
  // (ix+0x07) in the ACTOR_TABLE (0x8a80), and arms LAUNCH_ARMED_FLAG (0x8f3f) when the
  // fire condition holds. This is where the joystick/button of this frame becomes the
  // player-actor's intent, before any actor is stepped.
  generatePlayerControlInput(m);

  // Step 3 — stage-end phase gate (advanceToPhaseCompleteOnStageEnd, ROM 0x107d).
  // Watches the per-stage countdown STAGE_COUNTDOWN (0x8901); while it is still running
  // this is a no-op, but on its expiry the handler advances the sub-state selector,
  // enqueues the phase-1-complete display command, and seeds the field-1 countdown —
  // i.e. it is the transition that ends the active stage and moves the round forward.
  advanceToPhaseCompleteOnStageEnd(m);

  // Step 4 — per-frame object-update gate + helper chain (dispatchPerFrameActorUpdatePasses, ROM 0x20d4).
  // Checks the per-frame object-update gate, then runs the fixed chain of update helpers
  // that maintain the object world for this frame. This is the gate that can suppress the
  // object passes (e.g. when a board-clear/tamper condition holds) before the enemy work.
  dispatchPerFrameActorUpdatePasses(m);

  // Step 5 — service enemy spawns (serviceEnemySpawns, ROM 0x511b).
  // The per-frame enemy-update dispatcher: decides whether to introduce new enemies this
  // frame and drives the enemy spawn machinery, feeding the enemy-actor records the next
  // step will sweep.
  serviceEnemySpawns(m);

  // Step 6 — step every enemy actor's state (stepEnemyActorStates, ROM 0x1219).
  // Walks the 14 enemy-actor records at stride 0x18 through the ENEMY_ACTOR_TABLE region,
  // running the per-record state dispatcher on each with that record's pointer. This is the
  // per-frame AI/motion advance for the enemies, run after spawns so freshly-seeded records
  // are included.
  stepEnemyActorStates(m);

  // Step 7 — advance the enemy formation (dispatchFormationObjectStates, ROM 0x40bd).
  // Runs the object-state dispatcher over the four formation records in the FORMATION_TABLE
  // (0x8c30), advancing the coordinated group behaviour (gather / launch / teardown) that
  // sits on top of the individual enemy actors.
  dispatchFormationObjectStates(m);

  // Step 8 — rebuild the sprite display list (rebuildSpriteDisplayList, ROM 0x02ef).
  // Recomputes the per-frame sprite display list from the now-updated actor state: four
  // record groups, plus the arrow Y-tick, plus the flip-mirror tail. Run after all the
  // actors have moved this frame so the list reflects final positions before it is copied
  // out to the hardware sprite banks.
  rebuildSpriteDisplayList(m);

  // Step 9 — master actor update pipeline (runActorUpdatePipeline, ROM 0x5ae4).
  // The master per-frame actor updater: the final pass that reconciles/finalises actor
  // state for the frame after spawns, per-actor stepping, and formation dispatch.
  runActorUpdatePipeline(m);

  // Step 10 — emit one queued sound (drainSoundCommandRing, ROM 0x0e64).
  // Pulls one entry off the sound-command ring buffer and hands it to the audio CPU via the
  // SOUND_COMMAND_LATCH (0xa100) / AUDIO_IRQ_LATCH (0xa181) — gated by the demo-sounds DSW
  // and GAME_ACTIVE_FLAG — then frees the slot and advances the ring head. Last, so the
  // sound reflects everything that happened this frame.
  drainSoundCommandRing(m);
}
