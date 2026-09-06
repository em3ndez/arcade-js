// SPDX-License-Identifier: GPL-3.0-only
// Sequence-state handler (rst-28 dispatch target @ on SEQUENCE_STATE). Runs the four per-frame
// subsystem updates, then a two-phase countdown on the / timer pair. Phase 1: decrement the
// sub-timer; while it is still counting, done. On its expiry reload it, activate the descriptor
// slot named by the byte at, and bump DRAWN_COLUMN_COUNT. Phase 2: decrement the dwell timer
// while still counting, done. On its expiry reload it, advance SEQUENCE_STATE, and clear
// . The `ret` is left off each early-exit and the tail so the dispatch seam completes it.
import { loc_4008, loc_4009, loc_4058, SEQUENCE_STATE, DRAWN_COLUMN_COUNT } from "./names.js";
import { clearStridedTable } from "./clearStridedTable.js";
import { stageObjectsToSpriteShadow } from "./stageObjectsToSpriteShadow.js";
import { driveAllObjectSlots } from "./driveAllObjectSlots.js";
import { redrawTileColumnsPeriodically } from "./redrawTileColumnsPeriodically.js";
import { activateDescriptorSlot } from "./activateDescriptorSlot.js";

const TIMER_RELOAD = 0xd2;

export function activateDescriptorSlotsThenAdvanceSequence(m) {
  const { mem8 } = m;

  clearStridedTable(m);
  stageObjectsToSpriteShadow(m);
  driveAllObjectSlots(m);
  redrawTileColumnsPeriodically(m);

  // Phase 1: sub-timer countdown.
  const phase1 = (mem8[loc_4008] - 1) & 0xff;
  mem8[loc_4008] = phase1;
  if (phase1 !== 0) return; // still counting

  mem8[loc_4008] = TIMER_RELOAD;
  activateDescriptorSlot(m, loc_4009); // descriptor number held at (pre-decrement)
  mem8[DRAWN_COLUMN_COUNT] = mem8[DRAWN_COLUMN_COUNT] + 1; // byte-wide write wraps 0xff -> 0x00

  // Phase 2: dwell-timer countdown.
  const phase2 = (mem8[loc_4009] - 1) & 0xff;
  mem8[loc_4009] = phase2;
  if (phase2 !== 0) return; // still counting

  mem8[loc_4009] = TIMER_RELOAD;
  mem8[SEQUENCE_STATE] = mem8[SEQUENCE_STATE] + 1; // advance the state index (byte write wraps)
  mem8[loc_4058] = 0;
}
