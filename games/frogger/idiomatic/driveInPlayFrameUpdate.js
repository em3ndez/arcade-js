// SPDX-License-Identifier: GPL-3.0-only
/**
 * driveInPlayFrameUpdate — the in-play per-frame update dispatcher. Returns unless the game mode is
 * active play and the run flag is set, so it is a bare return in attract and boot. Otherwise it drives
 * one frame through the fixed sub-engine sequence, ending in the lane mover. The plain leaves dissolve;
 * the collision orchestrator and the two lane engines that tail-transfer are dispatched by address so
 * the seam keeps a balanced stack. LIVE-OUT: memory-only.
 */
import { GAME_MODE, INTRO_COUNTER_829B } from "./names.js";
import { driveExtraFrogHopAcross } from "./driveExtraFrogHopAcross.js";
import { advanceActiveFrogHops } from "./advanceActiveFrogHops.js";
import { renderFrogSceneAndTickTimer } from "./renderFrogSceneAndTickTimer.js";
import { driveScoreDisplayCountdown } from "./driveScoreDisplayCountdown.js";
import { advanceAnimationFrameBuffer } from "./advanceAnimationFrameBuffer.js";
import { driveFrogDeathAnimation } from "./driveFrogDeathAnimation.js";
import { tickGatedCountdown } from "./tickGatedCountdown.js";
import { moveLaneObjectsAndCarryFrog } from "./moveLaneObjectsAndCarryFrog.js";

const RUN_FLAG = INTRO_COUNTER_829B;
const COLLISION_ORCH = 0x1a55, SCROLL_ENGINE = 0x2005, MOVE_DISPATCHER = 0x11bf;

export function driveInPlayFrameUpdate(m) {
  const { mem8 } = m;

  if (mem8[GAME_MODE] !== 1) return;
  if (mem8[RUN_FLAG] === 0) return;

  driveExtraFrogHopAcross(m);
  m.push16(0x2351); m.call(COLLISION_ORCH);
  advanceActiveFrogHops(m);
  renderFrogSceneAndTickTimer(m);
  driveScoreDisplayCountdown(m);
  m.push16(0x235d); m.call(SCROLL_ENGINE);
  advanceAnimationFrameBuffer(m);
  m.push16(0x2363); m.call(MOVE_DISPATCHER);
  driveFrogDeathAnimation(m);
  tickGatedCountdown(m);
  return moveLaneObjectsAndCarryFrog(m);
}
