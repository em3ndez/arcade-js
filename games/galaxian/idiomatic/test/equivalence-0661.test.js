// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0661 — memory-equivalent to the frozen oracle at ROM 0x0661 (the per-frame play pipeline).
 * The routine runs 27 subsystem updates in ROM order, then a three-part quiescence guard, and only
 * when the field is idle ticks the sequence dwell timer (loc_4009 -> SEQUENCE_STATE 0x400a). Live-out
 * is memory-only: reached by a tail-dispatch, it rets into the NMI epilogue (loc_00d8) which restores
 * every register from the stack, so no register it leaves is read back — the RAM diff is the whole bar.
 *
 * Entries: the attract seed (guard bails at the side-flag test; the 27 sub-calls still populate RAM,
 * a strong positive control); a tail-running seed (0x4225=1, loc_4009=1 -> dec to 0 -> inc 0x400a);
 * a dec-only seed (loc_4009=5 -> no carry); and a guard-1-blocked seed. Teeth (independent twins built
 * from a pipeline replica): no-op, a dropped sub-call, a skipped tail, a skipped carry, a wrong carry
 * cell, an inverted side-flag guard, and a scribble proving ramDiff bites the carry cell.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent } from "./_bootSetup.js";
import { runGameplayFrameAndAdvanceOnFieldClear as cand } from "../runGameplayFrameAndAdvanceOnFieldClear.js";
import { loc_0661 as oracle } from "../../translated/loc_0661.js";
import {
  OBJ_ACTIVE_FLAG, SEQUENCE_STATE, VRAM_WRITE_PTR,
  loc_4201, loc_4208, loc_4225, loc_4260, loc_4009,
} from "../names.js";
import { moveControlledObjectAndStageSprite } from "../moveControlledObjectAndStageSprite.js";
import { advancePlayerShotAndStageSprite } from "../advancePlayerShotAndStageSprite.js";
import { advanceAndRenderProjectiles } from "../advanceAndRenderProjectiles.js";
import { stageObjectsToSpriteShadow } from "../stageObjectsToSpriteShadow.js";
import { armBehaviorGateOnInputOrTimer } from "../armBehaviorGateOnInputOrTimer.js";
import { flagPlayerShotHitOnFormation } from "../flagPlayerShotHitOnFormation.js";
import { flagProjectileHitsOnPlayer } from "../flagProjectileHitsOnPlayer.js";
import { flagPlayerShotHitsOnObjects } from "../flagPlayerShotHitsOnObjects.js";
import { flagObjectHitsOnPlayer } from "../flagObjectHitsOnPlayer.js";
import { clearGateOnPendingRequest } from "../clearGateOnPendingRequest.js";
import { spawnObjectsOnDelayedEvent } from "../spawnObjectsOnDelayedEvent.js";
import { launchAttackerFromFormation } from "../launchAttackerFromFormation.js";
import { chooseNextAttackerDirection } from "../chooseNextAttackerDirection.js";
import { rampCounterToCeiling } from "../rampCounterToCeiling.js";
import { handlePlayerHitEvent } from "../handlePlayerHitEvent.js";
import { driveGatedSoundStepSequence } from "../driveGatedSoundStepSequence.js";
import { driveDecayingSoundSweep } from "../driveDecayingSoundSweep.js";
import { paceEnemyLaunchTrigger } from "../paceEnemyLaunchTrigger.js";
import { scheduleDelayedEvent } from "../scheduleDelayedEvent.js";
import { fireDelayedEventRequest } from "../fireDelayedEventRequest.js";
import { selectAttackerRowScan } from "../selectAttackerRowScan.js";
import { armFormationAdvanceTrigger } from "../armFormationAdvanceTrigger.js";
import { advanceStageAndReseedFormation } from "../advanceStageAndReseedFormation.js";
import { driveSoundVoicesFromOccupancy } from "../driveSoundVoicesFromOccupancy.js";
import { expireActivityGatedTimer } from "../expireActivityGatedTimer.js";
import { computeControlledObjectMoveCommand } from "../computeControlledObjectMoveCommand.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

// Crafted entries. A ret word is seated for the oracle's ret; cells are poked to steer the guard.
const entryAttract = () => craft((mem, m) => { m.push16(0x9999); });
const entryTailInc = () => craft((mem, m) => { m.push16(0x9999); mem[loc_4225] = 1; mem[loc_4009] = 1; });
const entryTailDecOnly = () => craft((mem, m) => { m.push16(0x9999); mem[loc_4225] = 1; mem[loc_4009] = 5; });
const entryGuard1 = () => craft((mem, m) => { m.push16(0x9999); mem[loc_4225] = 1; mem[loc_4208] = 1; });

// The 27 subsystem updates in ROM order. The 0x0cc3 slot (co-batch) dispatches through the oracle
// table (m.call), matching the frozen oracle's pipeline exactly so a twin isolates only its own defect.
const SUBCALLS = [
  moveControlledObjectAndStageSprite, advancePlayerShotAndStageSprite, advanceAndRenderProjectiles,
  (m) => m.call(0x0cc3), stageObjectsToSpriteShadow, armBehaviorGateOnInputOrTimer,
  flagPlayerShotHitOnFormation, flagProjectileHitsOnPlayer, flagPlayerShotHitsOnObjects,
  flagObjectHitsOnPlayer, clearGateOnPendingRequest, spawnObjectsOnDelayedEvent,
  launchAttackerFromFormation, chooseNextAttackerDirection, rampCounterToCeiling,
  handlePlayerHitEvent, driveGatedSoundStepSequence, driveDecayingSoundSweep,
  paceEnemyLaunchTrigger, scheduleDelayedEvent, fireDelayedEventRequest, selectAttackerRowScan,
  armFormationAdvanceTrigger, advanceStageAndReseedFormation, driveSoundVoicesFromOccupancy,
  expireActivityGatedTimer, computeControlledObjectMoveCommand,
];
function pipeline(m, skipIndex = -1) {
  for (let i = 0; i < SUBCALLS.length; i++) if (i !== skipIndex) SUBCALLS[i](m);
}
function guardsPass(m) {
  if ((m.mem8[loc_4208] | m.mem8[loc_4201] | m.mem8[OBJ_ACTIVE_FLAG]) & 0x01) return false;
  if (!(m.mem8[loc_4225] & 0x01)) return false;
  let acc = 0;
  for (let i = 0; i < 14; i++) acc |= m.mem8[loc_4260 + 5 * i];
  return (acc & 0x01) === 0;
}

// Broken twins (each an independent reimplementation with exactly one defect).
const noOp = () => {};
const omitFirstSub = (m) => { pipeline(m, 0); if (!guardsPass(m)) return; const d = (m.mem8[loc_4009] - 1) & 0xff; m.mem8[loc_4009] = d; if (d !== 0) return; m.mem8[SEQUENCE_STATE] = m.mem8[SEQUENCE_STATE] + 1; };
const skipTail = (m) => { pipeline(m); guardsPass(m); /* never ticks the timer */ };
const skipCarry = (m) => { pipeline(m); if (!guardsPass(m)) return; m.mem8[loc_4009] = (m.mem8[loc_4009] - 1) & 0xff; /* never carries into 0x400a */ };
const wrongCarryCell = (m) => { pipeline(m); if (!guardsPass(m)) return; const d = (m.mem8[loc_4009] - 1) & 0xff; m.mem8[loc_4009] = d; if (d !== 0) return; m.mem8[VRAM_WRITE_PTR] = m.mem8[VRAM_WRITE_PTR] + 1; };
const invertedSideFlag = (m) => {
  pipeline(m);
  if ((m.mem8[loc_4208] | m.mem8[loc_4201] | m.mem8[OBJ_ACTIVE_FLAG]) & 0x01) return;
  if (m.mem8[loc_4225] & 0x01) return; // inverted: bails when the side flag is SET
  let acc = 0;
  for (let i = 0; i < 14; i++) acc |= m.mem8[loc_4260 + 5 * i];
  if (acc & 0x01) return;
  const d = (m.mem8[loc_4009] - 1) & 0xff; m.mem8[loc_4009] = d;
  if (d !== 0) return;
  m.mem8[SEQUENCE_STATE] = m.mem8[SEQUENCE_STATE] + 1;
};
const scribble = (m) => { cand(m); m.mem8[SEQUENCE_STATE] ^= 0xff; };

test("EQUAL: loc_0661 == oracle across guard branches", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, entryAttract()), null, "diverged: attract (guard bails at side flag)");
  assert.equal(ramDiff(oracle, cand, entryTailInc()), null, "diverged: tail runs, timer carries");
  assert.equal(ramDiff(oracle, cand, entryTailDecOnly()), null, "diverged: tail runs, dec only (no carry)");
  assert.equal(ramDiff(oracle, cand, entryGuard1()), null, "diverged: guard-1 blocked");

  // Positive controls (never vacuous): the oracle changed RAM on each shape.
  assert.ok(ramDiff(oracle, noOp, entryAttract()), "vacuous: oracle changed no RAM (attract pipeline)");
  const a = entryTailInc(); oracle(a);
  assert.equal(a.mem8[loc_4009], 0, "positive control: tail did not decrement loc_4009");
  assert.equal(a.mem8[SEQUENCE_STATE], 1, "positive control: tail did not carry into SEQUENCE_STATE");
  console.log("  EQUAL: attract, tail+carry, dec-only, guard-1 all match; tail loc_4009 1->0, 0x400a ->1");
});

test("TEETH: broken twins are caught", { skip }, () => {
  assert.ok(ramDiff(oracle, noOp, entryAttract()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, omitFirstSub, entryAttract()), "dropped-sub-call twin escaped");
  assert.ok(ramDiff(oracle, skipTail, entryTailInc()), "skipped-tail twin escaped");
  assert.ok(ramDiff(oracle, skipCarry, entryTailInc()), "skipped-carry twin escaped");
  assert.ok(ramDiff(oracle, wrongCarryCell, entryTailInc()), "wrong-carry-cell twin escaped");
  assert.ok(ramDiff(oracle, invertedSideFlag, entryTailInc()), "inverted-side-flag twin escaped (tail seed)");
  assert.ok(ramDiff(oracle, invertedSideFlag, entryAttract()), "inverted-side-flag twin escaped (attract seed)");
  assert.ok(ramDiff(oracle, scribble, entryTailInc()), "scribble twin escaped (ramDiff blind to carry cell)");
  console.log("  TEETH: no-op, dropped sub-call, skipped tail, skipped/wrong carry, inverted guard, scribble all caught");
});
