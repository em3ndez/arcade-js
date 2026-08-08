// SPDX-License-Identifier: GPL-3.0-only
/** loc_4f35 — run this stretch of a round's shot sweep against the FULL run of seven targets.
 *
 * MOTHER_SHIP_ARMED decides which of two sweeps runs, and choosing between them plus supplying the
 * seven-target run's arguments is the whole of this entry. While it is set the sweep that also
 * covers the standing object runs instead, and that one stages its own runs. While it is clear the
 * two cursor cells the shared sweep reloads between passes are staged here first, so every pass
 * restarts on the run chosen here, and the shared sweep then runs six shots against seven targets
 * inside one box. Both counts it is handed are seven, so the first pass is no shorter than the
 * rest. LIVE-OUT: memory only. */

import { destroyCraftAndMotherShipHitByShots } from "./destroyCraftAndMotherShipHitByShots.js";
import { destroyTargetsHitByShots } from "./destroyTargetsHitByShots.js";
import { MOTHER_SHIP_ARMED } from "./names.js";

const SHOT_RECORDS = 0xaa80;
const SHOTS = 6;
const TARGET_RECORDS = 0xa850;
const TARGET_ENTRIES = 0xaa1a;
const TARGETS = 7;
const REACH = 7;
const SPAN = 15;

const TARGET_ENTRY_CURSOR = 0xa991;
const TARGET_RECORD_CURSOR = 0xa993;

export function loc_4f35(m) {
  const { mem8, mem16 } = m;
  if (mem8[MOTHER_SHIP_ARMED] !== 0) {
    destroyCraftAndMotherShipHitByShots(m);
    return;
  }

  mem16[TARGET_RECORD_CURSOR] = TARGET_RECORDS;
  mem16[TARGET_ENTRY_CURSOR] = TARGET_ENTRIES;
  destroyTargetsHitByShots(
    m, SHOT_RECORDS, TARGET_ENTRIES, TARGET_RECORDS,
    TARGETS, TARGETS, SHOTS, REACH, SPAN,
  );
}
