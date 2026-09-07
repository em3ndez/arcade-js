// SPDX-License-Identifier: GPL-3.0-only
/**
 * queueColumnDrawAndAdvanceSequence -- a sequence-state handler that runs the four per-frame subsystem
 * updates, ticks the dwell timer, and on its expiry re-arms the timer, bumps the drawn-column count,
 * and queues one column-draw command word.
 *
 * WHAT IT IS
 *   An rst-28 dispatch target keyed on SEQUENCE_STATE (0x400a): every frame while this sub-state is
 *   active it drives the standard block of per-frame work (strided-table clear, sprite-shadow staging,
 *   object slots, periodic tile-column redraw), then counts down the dwell timer. It only advances the
 *   sequence when the dwell expires, so the sub-state holds for a fixed number of frames.
 *
 * ROLE IN THE MACHINE
 *   Dispatched via SEQUENCE_STATE. The dwell lives in the two-tier timer pair loc_4008 (fast sub-timer)
 *   / loc_4009 (dwell tier); on expiry the pair is re-armed from SEQUENCE_TIMER_PTR (low 0x40 into
 *   loc_4008, high 0x11 into loc_4009). loc_4058 is cleared. DRAWN_COLUMN_COUNT is the running count of
 *   tile-columns queued to redraw. The command word (channel 6, arg 0x0f) is a column-draw request
 *   posted through the deferred command queue.
 *
 *   The Z80 original tail-jumps into enqueueCommandWord carrying HL as the saved pointer
 *   (DRAWN_COLUMN_COUNT); that is dissolved here to a direct call passing DRAWN_COLUMN_COUNT as the
 *   saved-pointer argument, with the `ret` deliberately left off so the dispatch seam completes it.
 *
 * ROM 0x0267.  Grounding: [seen] (names.js ROUTINES cert).
 *
 * LIVE-OUT: memory only -- the dwell/state cells, loc_4058, DRAWN_COLUMN_COUNT, and one command-queue
 *   entry. The return value is enqueueCommandWord's restored pointer, consumed by the dispatch seam.
 */
import { loc_4008, loc_4009, loc_4058, SEQUENCE_STATE, DRAWN_COLUMN_COUNT } from "./names.js";
import { clearStridedTable } from "./clearStridedTable.js";
import { stageObjectsToSpriteShadow } from "./stageObjectsToSpriteShadow.js";
import { driveAllObjectSlots } from "./driveAllObjectSlots.js";
import { redrawTileColumnsPeriodically } from "./redrawTileColumnsPeriodically.js";
import { enqueueCommandWord } from "./enqueueCommandWord.js";

// The word re-armed into the timer pair on expiry: 0x11 is the dwell tier (loc_4009), 0x40 the fast
// sub-timer (loc_4008), stored as the high/low bytes of this 16-bit value.
const SEQUENCE_TIMER_PTR = (0x11 << 8) | 0x40; // pointer word installed into /
// The column-draw command word posted on expiry: channel 6, argument 0x0f.
const CMD_CHANNEL = 6;
const CMD_ARG = 0x0f;

export function queueColumnDrawAndAdvanceSequence(m) {
  const { mem8 } = m;

  // The four per-frame subsystem updates that run every frame this sub-state is active, regardless of
  // whether the dwell expires this frame: clear the strided table, stage objects into the sprite
  // shadow, drive all object slots, and redraw tile columns on their periodic schedule.
  clearStridedTable(m);
  stageObjectsToSpriteShadow(m);
  driveAllObjectSlots(m);
  redrawTileColumnsPeriodically(m);

  // Tick the dwell tier (loc_4009) down one, wrapping at the byte boundary. While it is still counting
  // (nonzero) the sub-state simply holds -- nothing further happens this frame.
  const remaining = (mem8[loc_4009] - 1) & 0xff;
  mem8[loc_4009] = remaining;
  if (remaining !== 0) return; // still counting

  // Dwell expired: advance to the next sub-state, clear loc_4058, and re-arm the two-tier timer pair
  // from SEQUENCE_TIMER_PTR (low byte to loc_4008, high byte to loc_4009) for the next hold.
  mem8[SEQUENCE_STATE] = mem8[SEQUENCE_STATE] + 1; // advance the paired state index (byte write wraps)
  mem8[loc_4058] = 0;
  mem8[loc_4008] = SEQUENCE_TIMER_PTR; // low byte (store truncates)
  mem8[loc_4009] = SEQUENCE_TIMER_PTR >> 8; // high byte
  // Bump the running count of columns queued to redraw (wraps at the byte boundary).
  mem8[DRAWN_COLUMN_COUNT] = mem8[DRAWN_COLUMN_COUNT] + 1; // byte-wide write wraps 0xff -> 0x00

  // Queue the column-draw command word (channel 6, arg 0x0f), passing DRAWN_COLUMN_COUNT as the saved
  // pointer the Z80 original carried in HL; enqueueCommandWord restores it and returns it.
  return enqueueCommandWord(m, (CMD_CHANNEL << 8) | CMD_ARG, DRAWN_COLUMN_COUNT);
}
