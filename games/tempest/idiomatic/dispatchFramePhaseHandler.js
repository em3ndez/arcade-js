// SPDX-License-Identifier: GPL-3.0-only
import { GAME_MODE, INPUT_EDGE_FLAGS, DSW1_COINAGE } from "./names.js";
import { stepSpikeTableCollapse } from "./stepSpikeTableCollapse.js";
import { resetLevelPlayfieldSlots } from "./resetLevelPlayfieldSlots.js";
import { setupLevelTimers } from "./setupLevelTimers.js";
import { runPerFrameUpdates } from "./runPerFrameUpdates.js";
import { tickEnemyPacingCountdown } from "./tickEnemyPacingCountdown.js";
import { reloadPacingFromPeakSlot } from "./reloadPacingFromPeakSlot.js";
import { commitPendingModeAfterDelay } from "./commitPendingModeAfterDelay.js";
import { bumpLevelEnemyQuota } from "./bumpLevelEnemyQuota.js";
import { buildSortedSoundRequest } from "./buildSortedSoundRequest.js";
import { tickActiveSoundSlot } from "./tickActiveSoundSlot.js";
import { seedModeParamsFromMaskedFlags } from "./seedModeParamsFromMaskedFlags.js";
import { tickWaveSpawnCadence, reseedWaveWorkingSet } from "./selectWaveStartSlot.js";
import { autoAdvanceRimRotation } from "./autoAdvanceRimRotation.js";
import { seedModeParamsWithBounds } from "./seedModeParamsWithBounds.js";
import { seedModeParamsMinimal } from "./seedModeParamsMinimal.js";
import { runFrameStateUpdaters } from "./runFrameStateUpdaters.js";
import { armModeAndRebuildIfEnabled } from "./armModeAndRebuildIfEnabled.js";
import { stepEnemyFleetAndSpawn } from "./stepEnemyFleetAndSpawn.js";

// DSW-gated per-frame handler dispatch: skip entirely when (DSW1_COINAGE & 0x83) == 0x82; otherwise run a
// pre-pass, set bit7 of INPUT_EDGE_FLAGS, and select one of the handlers by the byte offset in GAME_MODE. Index 6 is
// an unused table slot (its word is zero); the caller never selects it.
const TABLE = [
  resetLevelPlayfieldSlots, setupLevelTimers, runPerFrameUpdates, tickEnemyPacingCountdown, reloadPacingFromPeakSlot, commitPendingModeAfterDelay, null, bumpLevelEnemyQuota, buildSortedSoundRequest, tickActiveSoundSlot,
  seedModeParamsFromMaskedFlags, tickWaveSpawnCadence, autoAdvanceRimRotation, seedModeParamsWithBounds, reseedWaveWorkingSet, seedModeParamsMinimal, runFrameStateUpdaters, armModeAndRebuildIfEnabled, stepEnemyFleetAndSpawn,
];

export function dispatchFramePhaseHandler(m) {
  const { mem8 } = m;
  if ((mem8[DSW1_COINAGE] & 0x83) === 0x82) return;
  stepSpikeTableCollapse(m);
  const i = mem8[GAME_MODE];
  mem8[INPUT_EDGE_FLAGS] = mem8[INPUT_EDGE_FLAGS] | 0x80;
  return TABLE[i >> 1](m);
}
