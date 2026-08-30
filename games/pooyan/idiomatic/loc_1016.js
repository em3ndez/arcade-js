// SPDX-License-Identifier: GPL-3.0-only
import { tickHudRefresh } from "./tickHudRefresh.js";
import { loc_1042 } from "./loc_1042.js";
import { loc_107d } from "./loc_107d.js";
import { loc_20d4 } from "./loc_20d4.js";
import { serviceEnemySpawns } from "./serviceEnemySpawns.js";
import { loc_1219 } from "./loc_1219.js";
import { dispatchFormationObjectStates } from "./dispatchFormationObjectStates.js";
import { loc_02ef } from "./loc_02ef.js";
import { runActorUpdatePipeline } from "./runActorUpdatePipeline.js";
import { drainSoundCommandRing } from "./drainSoundCommandRing.js";

/**
 * loc_1016 — the active-play sub-state handler: run one frame's ten subsystem updates in order.
 *
 * HUD refresh, lead-actor input read, sub-state advance, object-update gate, enemy spawns,
 * enemy-record state sweep, formation state dispatch, sprite display-list rebuild, actor pipeline,
 * and finally drain one sound-command. Each step reads and mutates shared memory.
 *
 * LIVE-OUT: memory only — every effect is a side effect of the ten callees. No register output.
 */

export function loc_1016(m) {
  tickHudRefresh(m);
  loc_1042(m);
  loc_107d(m);
  loc_20d4(m);
  serviceEnemySpawns(m);
  loc_1219(m);
  dispatchFormationObjectStates(m);
  loc_02ef(m);
  runActorUpdatePipeline(m);
  drainSoundCommandRing(m);
}
