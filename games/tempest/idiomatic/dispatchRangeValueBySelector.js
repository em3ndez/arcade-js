// SPDX-License-Identifier: GPL-3.0-only
import { COORD_DISPATCH_SEL } from "./names.js";
import { fetchCoordListEntryByCounter, fetchCoordListEntryByIndex, readCoordListEntry } from "./fetchCoordListEntryByCounter.js";
import { sumCoordListEntryRun } from "./sumCoordListEntryRun.js";
import { resolveCoordListEntryToAbsolute } from "./resolveCoordListEntryToAbsolute.js";
import { selectListEntryByDeltaParity } from "./computeCoordListBackDelta.js";

// Computed dispatch: the selector byte (2,4,6,8,10,12) picks a coordinate helper and
// tail-returns its result to this routine's own caller. Slot 0 is unused.
const TABLE = [null, readCoordListEntry, fetchCoordListEntryByIndex, fetchCoordListEntryByCounter, sumCoordListEntryRun, resolveCoordListEntryToAbsolute, selectListEntryByDeltaParity];

export function dispatchRangeValueBySelector(m, y = m.regs.y) {
  const { mem8 } = m;
  return TABLE[mem8[COORD_DISPATCH_SEL] >> 1](m, y);
}
