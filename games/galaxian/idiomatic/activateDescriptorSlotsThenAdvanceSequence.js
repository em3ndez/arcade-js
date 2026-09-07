// SPDX-License-Identifier: GPL-3.0-only
/**
 * activateDescriptorSlotsThenAdvanceSequence — one attract sequence-state handler: run the shared
 * per-frame subsystem updates, then a two-tier countdown that periodically activates a descriptor slot
 * and eventually advances the sequence.
 *
 * WHAT IT IS
 *   An rst-28 dispatch target reached when SEQUENCE_STATE selects this attract sub-state. Every frame
 *   it runs the four common per-frame subsystem updates, then ticks a nested pair of timers on cells
 *   0x4008 (sub-timer) and 0x4009 (dwell). Each 0x4008 expiry activates a descriptor slot and bumps
 *   the tile-column redraw count; each 0x4009 expiry advances SEQUENCE_STATE to the next sub-state.
 *
 * ROLE IN THE MACHINE
 *   Sequence advancing "is literally the low timer carrying into the state byte" in this machine, but
 *   here the carry is done explicitly. SEQUENCE_STATE (0x400a) is the per-phase selector the attract
 *   handler dispatches on; DRAWN_COLUMN_COUNT (0x4241) gates redrawTileColumnsPeriodically. The four
 *   shared updates are clearStridedTable (wipe the broadcast lane), stageObjectsToSpriteShadow (records
 *   -> sprite shadow), driveAllObjectSlots (object-AI walk), and redrawTileColumnsPeriodically (VRAM
 *   column repaint). activateDescriptorSlot reads its descriptor number from cell 0x4009 before the
 *   phase-2 countdown touches it. Each early return omits the Z80 `ret`, which the dispatch seam adds.
 *
 * ROM 0x023f.  Grounding: [seen] (names.js cert).
 *
 * LIVE-OUT: timers 0x4008/0x4009, DRAWN_COLUMN_COUNT, SEQUENCE_STATE, 0x4058, and the activated
 * descriptor slot are written; plus whatever the four subsystem updates touch. No register result.
 */
import { loc_4008, loc_4009, loc_4058, SEQUENCE_STATE, DRAWN_COLUMN_COUNT } from "./names.js";
import { clearStridedTable } from "./clearStridedTable.js";
import { stageObjectsToSpriteShadow } from "./stageObjectsToSpriteShadow.js";
import { driveAllObjectSlots } from "./driveAllObjectSlots.js";
import { redrawTileColumnsPeriodically } from "./redrawTileColumnsPeriodically.js";
import { activateDescriptorSlot } from "./activateDescriptorSlot.js";

// Both timer tiers reload to 0xd2 (210 frames) when they expire.
const TIMER_RELOAD = 0xd2;

export function activateDescriptorSlotsThenAdvanceSequence(m) {
  const { mem8 } = m;

  // The four shared per-frame updates that every attract sequence-state handler runs before its own
  // timing logic: clear the broadcast lane, stage records to the sprite shadow, walk the object slots,
  // and periodically repaint the tile columns.
  clearStridedTable(m);
  stageObjectsToSpriteShadow(m);
  driveAllObjectSlots(m);
  redrawTileColumnsPeriodically(m);

  // Phase 1: tick the 0x4008 sub-timer. While it is still counting down, this frame is done.
  const phase1 = (mem8[loc_4008] - 1) & 0xff;
  mem8[loc_4008] = phase1;
  if (phase1 !== 0) return; // still counting

  // Sub-timer expired: reload it, activate the descriptor slot named by cell 0x4009 (read before the
  // phase-2 countdown decrements it), and bump the count of tile columns queued to redraw.
  mem8[loc_4008] = TIMER_RELOAD;
  activateDescriptorSlot(m, loc_4009); // descriptor number held at (pre-decrement)
  mem8[DRAWN_COLUMN_COUNT] = mem8[DRAWN_COLUMN_COUNT] + 1; // byte-wide write wraps 0xff -> 0x00

  // Phase 2: tick the 0x4009 dwell timer. While it is still counting down, this frame is done.
  const phase2 = (mem8[loc_4009] - 1) & 0xff;
  mem8[loc_4009] = phase2;
  if (phase2 !== 0) return; // still counting

  // Dwell expired: reload it, advance SEQUENCE_STATE to the next attract sub-state, and clear the
  // 0x4058 scratch cell.
  mem8[loc_4009] = TIMER_RELOAD;
  mem8[SEQUENCE_STATE] = mem8[SEQUENCE_STATE] + 1; // advance the state index (byte write wraps)
  mem8[loc_4058] = 0;
}
