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

// The in-game frame loop: run one frame of round work per pass, forever. Each pass advances round state,
// resolves the player shot and fleet, applies any pending score, then (while aliens remain) steps the
// shot rate, extra-ship award, and the sound services, gated by the arm-trigger poll. When ALIEN_COUNT
// reaches zero the round is cleared: hand off to the same-player next-round restart and stop looping here. The
// closing yield is the once-per-frame boundary the interrupt drives. Generator; memory + IO.
export function* mainLoop(m) {
  for (;;) {
    advanceRoundState(m);
    resolveShotAndFleetEdge(m);
    countLiveAliens(m);
    applyPendingScoreAdd(m);
    if (m.mem8[ALIEN_COUNT] === 0) {
      yield* advanceToNextRound(m);
      return;
    }
    selectAlienShotRate(m);
    awardExtraShip(m);
    setAlienShotStepWhenFew(m);
    updatePlayerShotSound(m);
    if (!isArmTriggerSet(m)) startSound(m, 0x04);
    m.io.portOut(0x06, advanceFleetMarchSound(m));
    updateSaucerSound(m);
    yield;
  }
}
