// SPDX-License-Identifier: GPL-3.0-only
// Sequence-state handler (rst-28 dispatch target): runs the four per-frame subsystem updates, then tail-jumps
// into (tickPrescaledSequenceTimer) to tick the prescaled sequence-dwell timer. Dissolved here to a
// direct call, with the `ret` left off so the dispatch seam completes it.
import { clearStridedTable } from "./clearStridedTable.js";
import { stageObjectsToSpriteShadow } from "./stageObjectsToSpriteShadow.js";
import { driveAllObjectSlots } from "./driveAllObjectSlots.js";
import { redrawTileColumnsPeriodically } from "./redrawTileColumnsPeriodically.js";
import { tickPrescaledSequenceTimer } from "./tickPrescaledSequenceTimer.js";

export function dwellThenAdvanceSequence(m) {
  clearStridedTable(m);
  stageObjectsToSpriteShadow(m);
  driveAllObjectSlots(m);
  redrawTileColumnsPeriodically(m);

  return tickPrescaledSequenceTimer(m);
}
