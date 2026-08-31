// SPDX-License-Identifier: GPL-3.0-only
import { runEagleApproachPhaseFrame } from "./runEagleApproachPhaseFrame.js";
import { runWaveLaunchPhaseFrame } from "./runWaveLaunchPhaseFrame.js";
import { clearWaveStateAndArenaOnHoldExpiry } from "./clearWaveStateAndArenaOnHoldExpiry.js";
import { rebuildSpriteDisplayList } from "./rebuildSpriteDisplayList.js";
import { WAVE_OUTER_PHASE } from "./names.js";
/**
 * dispatchBonusStagePhase — the per-frame driver for the eagle / bonus stage.
 *
 * WHAT IT IS
 *   The bonus stage is the interlude the game runs between rounds: the eagle sweeps in, a
 *   volley of arrows is launched, the arena is held for the payoff, and then everything is
 *   torn down so the machine can return to the round flow. That whole interlude is a tiny
 *   three-phase state machine, and this routine is the one frame-tick of it: each frame it
 *   looks at which phase the stage is currently in and runs that phase's body.
 *
 * ROLE IN THE MACHINE
 *   The per-frame play dispatch selects a handler by the in-play sub-state index, and this
 *   routine is the handler for the bonus/eagle sub-state (play sub-state 18). It is a
 *   second-level dispatcher: the sub-state index already narrowed the frame down to "we are
 *   in a bonus stage", and this routine narrows it the rest of the way down to "and we are in
 *   phase N of that bonus stage".
 *
 * ROM ADDRESS
 *   0x71b9. The three phase bodies are selected through the inline 3-word jump table at
 *   0x71c1 (entries 0x71c7 / 0x72a0 / 0x7421). The shared epilogue lives at 0x02ef.
 *
 * Grounding: [seen]
 *
 * LIVE-OUT
 *   Memory only. This routine returns no value of its own; its whole effect is the side
 *   effects the selected phase body and the shared epilogue write into machine memory (the
 *   eagle/arrow actor state, the wave-launch driver's cells, and the rebuilt sprite display
 *   list). Which of the three bodies runs is chosen entirely by WAVE_OUTER_PHASE (0x8f38).
 */
export function dispatchBonusStagePhase(m) {
  // Read the outer phase of the eagle/bonus stage from WAVE_OUTER_PHASE (0x8f38) and branch to
  // that phase's body. This is the ROM's `rst 0x28` table dispatch through the 3-word table at
  // 0x71c1 — the counter at 0x8f38 indexes one of three entries, and there are only ever three.
  switch (m.mem8[WAVE_OUTER_PHASE]) {
    // Phase 0 — approach. The eagle/arrow approach state machine is stepped forward one tick,
    // then the shared per-frame object update runs. This is the opening of the interlude, while
    // the eagle is still moving into position. (ROM 0x71c7.)
    case 0: runEagleApproachPhaseFrame(m); break;
    // Phase 1 — launch. The shared per-frame update runs first, then the wave-launch driver
    // fires: this is the phase that actually seeds and launches the wave of arrows. (ROM 0x72a0.)
    case 1: runWaveLaunchPhaseFrame(m); break;
    // Phase 2 — hold-expiry teardown. When the stage's hold timer runs out this clears the
    // wave/enemy state left behind by the launch and hands the machine back to the attract
    // sub-state, ending the interlude. (ROM 0x7421.)
    case 2: clearWaveStateAndArenaOnHoldExpiry(m); break;
    // The dispatch table at 0x71c1 holds exactly three entries, so a real machine never presents
    // a phase above 2; this arm is a defensive guard that would fire only on a corrupted counter.
    default:
      throw new Error("dispatchBonusStagePhase: bonus/eagle phase > 2 (guard-slack; the table has 3 entries)");
  }
  // Shared epilogue (ROM 0x02ef): rebuild the sprite display list for this frame. In the ROM
  // each phase body's return address is 0x02ef, so every phase falls through into this same
  // rebuild — the eagle, the arrows, and the arena actors are all reprojected into the display
  // list here before control unwinds to the caller.
  return rebuildSpriteDisplayList(m); // shared epilogue the handler returned into
}
