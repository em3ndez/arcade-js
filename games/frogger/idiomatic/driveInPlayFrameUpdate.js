// SPDX-License-Identifier: GPL-3.0-only
/**
 * driveInPlayFrameUpdate — the in-play per-frame update dispatcher. Returns unless the game mode is
 * active play and the run flag is set (a bare return in attract/boot). Otherwise it drives one frame
 * through the fixed sub-engine sequence. The scroll driver and frog-move dispatcher are plain direct
 * calls; the collision orchestrator stays address-dispatched (its goal path reaches a caller-skip, so
 * the pushed continuation is load-bearing). LIVE-OUT: memory-only.
 */
import {
  GAME_MODE, INTRO_COUNTER_829B, COLLISION_ORCH_ENTRY, COLLISION_ORCH_TRAMPOLINE_RETURN,
} from "./names.js";
import { driveAttractDemoFrogHop } from "./driveAttractDemoFrogHop.js";
import { advanceAttractDemoFrogHop } from "./advanceAttractDemoFrogHop.js";
import { renderFrogSceneAndTickTimer } from "./renderFrogSceneAndTickTimer.js";
import { driveScoreDisplayCountdown } from "./driveScoreDisplayCountdown.js";
import { advanceScrollLaneObjects } from "./advanceScrollLaneObjects.js";
import { advanceAnimationFrameBuffer } from "./advanceAnimationFrameBuffer.js";
import { dispatchFrogMoveAgainstLanes } from "./dispatchFrogMoveAgainstLanes.js";
import { driveFrogDeathAnimation } from "./driveFrogDeathAnimation.js";
import { tickGatedCountdown } from "./tickGatedCountdown.js";
import { moveLaneObjectsAndCarryFrog } from "./moveLaneObjectsAndCarryFrog.js";

const RUN_FLAG = INTRO_COUNTER_829B;

export function driveInPlayFrameUpdate(m) {
  const { mem8 } = m;

  if (mem8[GAME_MODE] !== 1) return;
  if (mem8[RUN_FLAG] === 0) return;

  driveAttractDemoFrogHop(m);
  m.push16(COLLISION_ORCH_TRAMPOLINE_RETURN); m.call(COLLISION_ORCH_ENTRY); // kept: goal-award caller-skip needs the buffer
  advanceAttractDemoFrogHop(m);
  renderFrogSceneAndTickTimer(m);
  driveScoreDisplayCountdown(m);
  advanceScrollLaneObjects(m);
  advanceAnimationFrameBuffer(m);
  dispatchFrogMoveAgainstLanes(m);
  driveFrogDeathAnimation(m);
  tickGatedCountdown(m);
  return moveLaneObjectsAndCarryFrog(m);
}
