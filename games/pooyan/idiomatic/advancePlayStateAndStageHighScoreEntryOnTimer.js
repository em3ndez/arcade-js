// SPDX-License-Identifier: GPL-3.0-only
import { loc_05b2 } from "./loc_05b2.js";
import { fillAttributeColumns } from "./fillAttributeColumns.js";
import { loc_03e9 } from "./loc_03e9.js";
import { loc_0038 } from "./loc_0038.js";
import { u8, u16 } from "../../../core/int.js";
import { queueFixedSoundCommandRun } from "./queueFixedSoundCommandRun.js";
import {
  PHASE_TIMER,
  PLAY_STATE_INDEX,
  HIGH_SCORE_INSERT_RANK,
  WIPE_COLUMN_VRAM_BASE,
  WIPE_COLUMN_VRAM_PTR,
  WIPE_COLUMN_FILL_TILE,
  DISPLAY_MSG_BUF,
  OBJECT_SPAWN_DISPLAY_CMD,
} from "./names.js";
/**
 * advancePlayStateAndStageHighScoreEntryOnTimer — play-state dispatch handler gated on the phase timer.
 *
 * Ticks the phase timer and returns until it expires. On expiry it plays three sounds, paints a
 * tilemap column strip and its frame, enqueues a display command, and advances the play sub-state.
 * Then, only when the high-score insert rank is nonzero, it builds a stride-2 column pointer from the
 * wipe base, seeds the wipe tile, and copies a source table (rotate-left through carry per byte) into
 * the display buffer up to the terminator.
 *
 * LIVE-OUT: none — a void dispatch handler; every effect is a memory write or a kept sub-call.
 */

const SUBSTATE_ADVANCE = 0x0e;
const WIPE_SEED_TILE = 0x07;
const TABLE_TERMINATOR = 0x5a;
const TABLE_SRC = 0x1754; // source table copied into the display buffer

export function advancePlayStateAndStageHighScoreEntryOnTimer(m) {
  const { mem8, mem16 } = m;

  mem8[PHASE_TIMER] = u8(mem8[PHASE_TIMER] - 1);
  if (mem8[PHASE_TIMER] !== 0) return; // phase timer not expired

  loc_05b2(m, 0x82); // play sound (id in A)
  loc_05b2(m, 0x80);
  loc_05b2(m, 0x89);
  fillAttributeColumns(m, 0x07d9); // paint the column strip
  loc_03e9(m); // paint its frame
  loc_0038(m, OBJECT_SPAWN_DISPLAY_CMD); // enqueue a display command

  mem8[PLAY_STATE_INDEX] = SUBSTATE_ADVANCE;
  const rank = mem8[HIGH_SCORE_INSERT_RANK];
  if (rank === 0) return;

  let lo = u8(WIPE_COLUMN_VRAM_BASE); // advance the column low byte by 2 per rank step (page fixed)
  for (let i = 0; i < rank; i++) lo = u8(lo + 2);
  mem16[WIPE_COLUMN_VRAM_PTR] = (WIPE_COLUMN_VRAM_BASE & 0xff00) | lo;

  queueFixedSoundCommandRun(m); // enqueue the four-tile text sequence

  mem8[WIPE_COLUMN_FILL_TILE] = WIPE_SEED_TILE;
  let src = TABLE_SRC;
  let dst = DISPLAY_MSG_BUF;
  for (;;) { // copy the source table (rotate-left through carry per byte) until the terminator
    const b = mem8[src];
    if (b === TABLE_TERMINATOR) return;
    const carryIn = b < TABLE_TERMINATOR ? 1 : 0; // carry from the compare against the terminator
    mem8[dst] = u8((b << 1) | carryIn);
    src = u16(src + 1);
    dst = u16(dst + 1);
  }
}
