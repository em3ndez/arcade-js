// SPDX-License-Identifier: GPL-3.0-only
/** loc_1199 — the round engine's per-frame service list: run every subsystem in fixed order,
 * then read the player-state byte and either advance the round, hand a life over, or do nothing. */

import { reaimAndAnimateEnemyCraftOnPhaseTick } from "./reaimAndAnimateEnemyCraftOnPhaseTick.js";
import { dispatchPlayerFrameByState } from "./dispatchPlayerFrameByState.js";
import { fireAndSweepPlayerShots } from "./fireAndSweepPlayerShots.js";
import { driveEnemyWaveForLifePhase } from "./driveEnemyWaveForLifePhase.js";
import { multiplexSpriteSlotsSkipping } from "./multiplexSpriteSlotsSkipping.js";
import { runParachutistSlot } from "./runParachutistSlot.js";
import { stepSevenCraftSlots } from "./stepSevenCraftSlots.js";
import { runSceneryForEra } from "./runSceneryForEra.js";
import { sweepEra2PlusObjectBank } from "./sweepEra2PlusObjectBank.js";
import { serviceEra1BomberObject } from "./serviceEra1BomberObject.js";
import { loc_3dda } from "./loc_3dda.js";
import { stepFourActorSlots } from "./stepFourActorSlots.js";
import { serviceEra0BallisticObjectBank } from "./serviceEra0BallisticObjectBank.js";
import { dispatchCollisionPassByEra } from "./dispatchCollisionPassByEra.js";
import { askForSoundWhileTheGroupIsClear } from "./askForSoundWhileTheGroupIsClear.js";
import { loc_4dde } from "./loc_4dde.js";
import { expireHitChain } from "./expireHitChain.js";
import { escalateDifficultyRungOnCounterWrap } from "./escalateDifficultyRungOnCounterWrap.js";
import { drawKillMeter } from "./drawKillMeter.js";
import { multiplexSpriteSlots } from "./multiplexSpriteSlots.js";
import { advanceRoundWhenFieldCleared } from "./advanceRoundWhenFieldCleared.js";
import { loseLifeAndHandOver } from "./loseLifeAndHandOver.js";

const PLAYER_STATE = 0xa800;
const DEAD = 0xff;

export function loc_1199(m) {
  // These two callees return through a stack word, so the call site supplies one, as a real call
  // would; the rest are plain functions. The seat is restored either way, so the value is a filler.
  const spriteFixup = () => { m.push16(0); multiplexSpriteSlotsSkipping(m); };

  reaimAndAnimateEnemyCraftOnPhaseTick(m);
  dispatchPlayerFrameByState(m);
  fireAndSweepPlayerShots(m);
  driveEnemyWaveForLifePhase(m);
  spriteFixup();
  runParachutistSlot(m);
  m.push16(0);
  m.call(0x43b7);
  stepSevenCraftSlots(m);
  spriteFixup();
  runSceneryForEra(m);
  sweepEra2PlusObjectBank(m);
  spriteFixup();
  serviceEra1BomberObject(m);
  loc_3dda(m);
  stepFourActorSlots(m);
  spriteFixup();
  serviceEra0BallisticObjectBank(m);
  dispatchCollisionPassByEra(m);
  askForSoundWhileTheGroupIsClear(m);
  spriteFixup();
  loc_4dde(m);
  expireHitChain(m);
  escalateDifficultyRungOnCounterWrap(m);
  drawKillMeter(m);
  multiplexSpriteSlots(m);

  const state = m.mem.read8(PLAYER_STATE);
  if (state === DEAD) return advanceRoundWhenFieldCleared(m);
  if (state !== 0) return;
  return loseLifeAndHandOver(m);
}
