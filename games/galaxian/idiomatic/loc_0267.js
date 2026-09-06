// SPDX-License-Identifier: GPL-3.0-only
// Sequence-state handler (rst-28 dispatch target): runs the four per-frame subsystem updates, then counts
// down the dwell timer. While it is still counting, done. On its expiry: advance SEQUENCE_STATE,
// clear, install the pointer word into the / pair, bump DRAWN_COLUMN_COUNT,
// and enqueue command word (channel 6, arg 0x0f). The tail-jumps into (enqueueCommandWord)
// carrying HL as the saved pointer; dissolved here to a direct call, with the `ret` left off so the
// dispatch seam completes it.
import { loc_4008, loc_4009, loc_4058, SEQUENCE_STATE, DRAWN_COLUMN_COUNT } from "./names.js";
import { clearStridedTable } from "./clearStridedTable.js";
import { stageObjectsToSpriteShadow } from "./stageObjectsToSpriteShadow.js";
import { loc_0cc3 } from "./loc_0cc3.js";
import { redrawTileColumnsPeriodically } from "./redrawTileColumnsPeriodically.js";
import { enqueueCommandWord } from "./enqueueCommandWord.js";

const SEQUENCE_TIMER_PTR = (0x11 << 8) | 0x40; // pointer word installed into /
const CMD_CHANNEL = 6;
const CMD_ARG = 0x0f;

export function loc_0267(m) {
  const { mem8 } = m;

  clearStridedTable(m);
  stageObjectsToSpriteShadow(m);
  loc_0cc3(m);
  redrawTileColumnsPeriodically(m);

  const remaining = (mem8[loc_4009] - 1) & 0xff;
  mem8[loc_4009] = remaining;
  if (remaining !== 0) return; // still counting

  mem8[SEQUENCE_STATE] = mem8[SEQUENCE_STATE] + 1; // advance the paired state index (byte write wraps)
  mem8[loc_4058] = 0;
  mem8[loc_4008] = SEQUENCE_TIMER_PTR; // low byte (store truncates)
  mem8[loc_4009] = SEQUENCE_TIMER_PTR >> 8; // high byte
  mem8[DRAWN_COLUMN_COUNT] = mem8[DRAWN_COLUMN_COUNT] + 1; // byte-wide write wraps 0xff -> 0x00

  // DE=, HL=DRAWN_COLUMN_COUNT, jp -> enqueue and restore the saved pointer.
  return enqueueCommandWord(m, (CMD_CHANNEL << 8) | CMD_ARG, DRAWN_COLUMN_COUNT);
}
