// SPDX-License-Identifier: GPL-3.0-only
import { descendObjectThenAdvanceStateAtBottom } from "./descendObjectThenAdvanceStateAtBottom.js";
import { reinitRoundArenaAndPlayfieldIfImageIntact } from "./reinitRoundArenaAndPlayfieldIfImageIntact.js";
/**
 * dispatchDescendingObjectState — per-object state handler for one record based at IX.
 *
 * An inactive record (its +1 byte zero) is skipped. Otherwise the state byte (IX+2) picks a
 * handler through a two-entry table indexed by (state - 1) & 3: index 0 steps the descending
 * object, index 1 runs the screen re-init/integrity path. Each is a tail hand-off, so the chosen
 * handler returns straight to our caller.
 *
 * LIVE-OUT: memory only — the record-scan caller brackets its loop registers and reads nothing back.
 */

export function dispatchDescendingObjectState(m, rec = m.regs.ix) {
  const { mem8 } = m;

  if (mem8[rec + 0x01] === 0) return; // inactive slot

  switch ((mem8[rec + 0x02] - 1) & 0x03) {
    case 0: return descendObjectThenAdvanceStateAtBottom(m, rec);
    case 1: return reinitRoundArenaAndPlayfieldIfImageIntact(m, rec);
  }
}
