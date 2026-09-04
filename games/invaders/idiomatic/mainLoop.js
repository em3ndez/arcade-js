// SPDX-License-Identifier: GPL-3.0-only
import { advanceRoundState } from "./advanceRoundState.js";
import { resolveShotAndFleetEdge } from "./resolveShotAndFleetEdge.js";
import { countLiveAliens } from "./countLiveAliens.js";
import { applyPendingScoreAdd } from "./applyPendingScoreAdd.js";
import { selectAlienShotRate } from "./selectAlienShotRate.js";
import { awardExtraShip } from "./awardExtraShip.js";
import { setAlienShotStepWhenFew } from "./setAlienShotStepWhenFew.js";
import { updatePlayerShotSound } from "./updatePlayerShotSound.js";
import { isArmTriggerSet } from "./isArmTriggerSet.js";
import { startSound } from "./startSound.js";
import { advanceFleetMarchSound } from "./advanceFleetMarchSound.js";
import { updateSaucerSound } from "./updateSaucerSound.js";
import { advanceToNextRound } from "./advanceToNextRound.js";
import { ALIEN_COUNT } from "./names.js";

/**
 * mainLoop — the in-game frame loop (the spine of a round).
 *
 * WHAT IT IS
 *   The forever-loop the game runs once a round is under way. Each pass is one displayed frame of
 *   round logic: advance the pre-round arm step, resolve the player shot and fleet edge, recount the
 *   live aliens, apply any queued score, and — while aliens remain — run the alien-shot rate, the
 *   extra-ship award, the low-alien step, and the per-frame sound services. It maps the ROM's
 *   loc_081f (body) + loc_0849 (tail), where 0x0849 tail-jumps back to 0x081f so the body repeats.
 *
 * ROLE IN THE MACHINE
 *   Reached from the round-start chain (startRoundFlow -> ... -> enterRound*), which marks the game
 *   active and falls in here. countLiveAliens republishes ALIEN_COUNT (0x2082) each pass; that count
 *   is the loop's exit condition and also what downstream code reads to feel the fleet's pace. The
 *   closing `yield` is the once-per-frame boundary the interrupt drives (the ISR does the vblank/mid
 *   work between passes). Generator; touches memory and IO.
 *
 * ROM 0x081f-0x0853.  Grounding: [seen].
 *
 * LIVE-OUT: memory + IO; returns (ending the generator) only when the wave is cleared.
 */
export function* mainLoop(m) {
  for (;;) {
    // Pre-round arm step: while armed and the field is idle, advance the attract pointer or arm the
    // player shot on a fresh fire edge (advanceRoundState decides by GAME_IN_PROGRESS).
    advanceRoundState(m);
    // Move the player shot one step and, at a screen edge, reverse+drop the whole fleet.
    resolveShotAndFleetEdge(m);
    // Recount survivors into ALIEN_COUNT (0x2082) and flag the last-alien case.
    countLiveAliens(m);
    // Fold any queued score packet into the active player's BCD total and repaint it.
    applyPendingScoreAdd(m);
    // Wave cleared: no aliens left. Hand off to the SAME player's next round and end this loop.
    if (m.mem8[ALIEN_COUNT] === 0) {
      yield* advanceToNextRound(m);
      return;
    }
    // Aliens remain — the per-frame in-game services follow.
    // Pick the alien-shot cadence from how thin the fleet is (fewer aliens -> faster shots).
    selectAlienShotRate(m);
    // Grant the one-time bonus ship once the score crosses the dip-switch threshold.
    awardExtraShip(m);
    // Speed the alien-shot descent when only a few aliens survive.
    setAlienShotStepWhenFew(m);
    // Raise/clear the player-shot sound bit to match whether a shot is in flight.
    updatePlayerShotSound(m);
    // Round-start blip: play sound cue 0x04 unless the arm trigger ([0x2015]==0xff) is set.
    if (!isArmTriggerSet(m)) startSound(m, 0x04);
    // Do the fleet-march pitch/tempo work, then write its leftover accumulator to port 6 — the
    // mw8080bw board's watchdog, which must be kicked each frame or the hardware resets.
    m.io.portOut(0x06, advanceFleetMarchSound(m));
    // Drive the saucer's continuous whine on/off from its active/hit flags.
    updateSaucerSound(m);
    // Frame boundary: the interrupt runs its vblank/mid work before the next pass.
    yield;
  }
}
