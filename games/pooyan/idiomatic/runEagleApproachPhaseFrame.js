// SPDX-License-Identifier: GPL-3.0-only
import { dispatchPerFrameActorUpdatePasses } from "./dispatchPerFrameActorUpdatePasses.js";
import { advanceEagleApproachAndPaintGridMarker } from "./advanceEagleApproachAndPaintGridMarker.js";

/**
 * runEagleApproachPhaseFrame — the per-frame body for phase 0 of the eagle bonus wave.
 *
 * WHAT IT IS
 *   ROM 0x71c7-0x71cd. Grounding: [seen]. One of the two tiny top-level bodies the bonus
 *   stage runs each frame. It does nothing itself except call two subsystems in a fixed
 *   order — the eagle-approach state machine, then the shared per-frame object update.
 *
 * ROLE IN THE MACHINE
 *   Pooyan's bonus stage runs its own wave pipeline instead of the ordinary attack waves.
 *   The play sub-state dispatcher hands the bonus stage to a small phase dispatcher, which
 *   selects between two phase bodies: phase 0 is this routine (the eagle's APPROACH), and
 *   phase 1 is runWaveLaunchPhaseFrame (the eagle's launch/dive). During the approach phase
 *   the eagle sweeps in across a lattice of grid cells toward the firing line while the
 *   player lines up and fires; this body performs the two things that phase needs every
 *   frame:
 *     1. step the eagle-approach state machine (drives the aim indicator and paints the
 *        eagle's advancing grid-marker trail), then
 *     2. run the shared object update every gameplay phase relies on (moves the player,
 *        runs the launch/target pipeline, ticks animation, renders, dispatches formation
 *        slots) — which, during this phase, also walks the wave's live eagle records.
 *
 * LIVE-OUT
 *   Memory only. Neither sub-call returns a value, and each reads its own state straight
 *   from work RAM, so this body threads nothing between them and hands nothing back.
 */
export function runEagleApproachPhaseFrame(m) {
  // STEP 1 — EAGLE-APPROACH STATE MACHINE (ROM 0x71ce, invoked first from 0x71c7).
  // advanceEagleApproachAndPaintGridMarker gates on the inter-wave hold countdown
  // (WAVE_HOLD_TIMER, 0x8f36); once that has drained it reads the eagle's advancing approach
  // coordinate from PLAYER_Y (0x8a84 — this cell carries the eagle's approach X during the
  // bonus phase, not the player's Y), sets the aim-indicator bits in PLAYER_AIM_FLAGS
  // (0x8a87) from where that coordinate sits relative to the near/far thresholds (0x59/0x60),
  // and, once armed, stamps one grid-marker tile (0x2c) plus its colour attribute into the
  // grid region at EAGLE_GRID_VRAM_BASE (0x87e0) every eighth frame. It runs FIRST so the
  // aim/grid state for this frame is settled before the object pass renders the actors.
  advanceEagleApproachAndPaintGridMarker(m);

  // STEP 2 — SHARED PER-FRAME OBJECT UPDATE (ROM 0x20d4, invoked next from 0x71ca).
  // dispatchPerFrameActorUpdatePasses is the object-update run by most gameplay phases: it
  // moves the player and ticks the status render, runs the launch/target actor pipeline,
  // blits the two-tile animation frame, renders the marker column, and dispatches the
  // formation/launch slots — after first gating on the play-mode latch and grab flag. During
  // the eagle bonus phase this same pass also walks the wave's live eagle records, so the
  // eagle actors advance alongside the player each frame.
  dispatchPerFrameActorUpdatePasses(m);
}
