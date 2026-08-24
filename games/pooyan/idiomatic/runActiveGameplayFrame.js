// SPDX-License-Identifier: GPL-3.0-only
import { loc_1e55 } from "./loc_1e55.js";
import { acquireTargetLockAndSetAimIndicator } from "./acquireTargetLockAndSetAimIndicator.js";
import { loc_20d4 } from "./loc_20d4.js";
import { serviceEnemySpawns } from "./serviceEnemySpawns.js";
import { dispatchAllEnemyActorStates } from "./dispatchAllEnemyActorStates.js";
import { dispatchFormationObjectStates } from "./dispatchFormationObjectStates.js";
import { loc_02ef } from "./loc_02ef.js";
import { loc_18da } from "./loc_18da.js";
import { loc_191c } from "./loc_191c.js";
import { runActorUpdatePipeline } from "./runActorUpdatePipeline.js";
import { loc_196e } from "./loc_196e.js";
import { drawStageLabelOncePerLevel } from "./drawStageLabelOncePerLevel.js";
import { loc_6b3b } from "./loc_6b3b.js";
import { loc_19ca } from "./loc_19ca.js";
/**
 * runActiveGameplayFrame — gameplay-state index-4 per-frame coordinator (dispatch-table entry 4).
 *
 * Runs fourteen per-frame sub-handlers in fixed order, then returns. Each is a balanced-wire
 * call (net SP 0) and each sub-handler reads its own state from RAM, so this driver marshals no
 * register and holds no live-out. All fourteen callees are lifted, so every call is dissolved.
 *
 * LIVE-OUT: none — a void coordinator; its dispatcher reads no register back.
 */
export function runActiveGameplayFrame(m) {
  loc_1e55(m);
  acquireTargetLockAndSetAimIndicator(m);
  loc_20d4(m);
  serviceEnemySpawns(m);
  dispatchAllEnemyActorStates(m);
  dispatchFormationObjectStates(m);
  loc_02ef(m);
  loc_18da(m);
  loc_191c(m);
  runActorUpdatePipeline(m);
  loc_196e(m);
  drawStageLabelOncePerLevel(m);
  loc_6b3b(m);
  loc_19ca(m);
}
