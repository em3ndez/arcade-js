// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  HUD_INTEGRITY_STRIP_A,
  ANIM_FRAME_COUNTER,
  SCRIPT_FRAME_TIMER,
  ATTRACT_SUBSTATE,
  SCRIPT_COL_CHECK_TICK,
  SCRIPT_WRITE_PTR,
  ROUND_TILE_DST,
  INTRO_DELAY_CKSUM_WORD,
  MAIN_GAME_STATE,
  ATTRACT_SCRIPT_PTR_TABLE,
} from "./names.js";
import { resetToAttractScreenStart } from "./resetToAttractScreenStart.js";
import { advanceAttractAnimationAndRepaint } from "./advanceAttractAnimationAndRepaint.js";
import { advanceFourObjectAnimsAndRebuildList } from "./advanceFourObjectAnimsAndRebuildList.js";
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { blankRowThenFloodColorsAndAdvanceAttract } from "./blankRowThenFloodColorsAndAdvanceAttract.js";
import { resetActorStateForBoard } from "./resetActorStateForBoard.js";
/**
 * advanceAttractSequenceToPlay — attract sub-state 6 handler.
 *
 * Verifies ten 0x20-strided pairs in the integrity block (any mismatch re-enters the attract
 * sub-state-0 handler). Runs the frame-animation timer and the object/sprite rebuild, then the
 * script-frame timer; on its expiry it seats the next script pointer at SCRIPT_WRITE_PTR from the
 * attract script-pointer table. Every SCRIPT_COL_CHECK_TICK ticks it runs a 14x29 column checksum
 * (sum low byte + carry count) over the round-tile grid and verifies it against the two bytes at the
 * INTRO_DELAY_CKSUM_WORD pointer: a low-byte miss re-enters the attract sub-state-0 handler, a
 * high-byte miss enters attract sub-state 1, a clean pass clears the check word, sets the main state
 * to 3 (play) and advances to the next screen builder.
 *
 * LIVE-OUT: none — a void attract handler; each exit is a tail into a sibling or a plain return.
 */
const ROW_STRIDE = 0x20; // distance between the two compared integrity rows (one row back = -0x20)
const PAIR_COUNT = 10; // integrity-block pairs verified
const CHECK_COLS = 14; // column-checksum outer count
const CHECK_ROWS = 29; // column-checksum inner count (bytes per column)
const PLAY_STATE = 3; // main-state value seated on a clean pass

export function advanceAttractSequenceToPlay(m) {
  const { mem8, mem16 } = m;

  // Verify the integrity block: each byte equals the one a row (0x20) below it.
  let row = HUD_INTEGRITY_STRIP_A;
  for (let i = 0; i < PAIR_COUNT; i++) {
    const top = mem8[row];
    row = u16(row - ROW_STRIDE);
    if (top !== mem8[row]) return resetToAttractScreenStart(m); // row mismatch -> re-enter sub-state 0
  }

  const anim = (mem8[ANIM_FRAME_COUNTER] - 1) & 0xff;
  mem8[ANIM_FRAME_COUNTER] = anim;
  if (anim === 0) advanceAttractAnimationAndRepaint(m); // wrap -> advance the attract animation
  advanceFourObjectAnimsAndRebuildList(m); // step the object records + rebuild the sprite list

  const timer = (mem8[SCRIPT_FRAME_TIMER] - 1) & 0xff;
  mem8[SCRIPT_FRAME_TIMER] = timer;
  if (timer !== 0) return; // script timer still running

  // Timer expired: reseed it, step the sub-state, seat the next script pointer.
  mem8[SCRIPT_FRAME_TIMER] = 1;
  mem8[ATTRACT_SUBSTATE] = (mem8[ATTRACT_SUBSTATE] - 1);
  const idx = (mem8[SCRIPT_COL_CHECK_TICK] - 1) & 0xff;
  mem16[SCRIPT_WRITE_PTR] = fetchWordFromTableIndex(m, idx, ATTRACT_SCRIPT_PTR_TABLE); // DE = table[idx]

  const tick = (mem8[SCRIPT_COL_CHECK_TICK] - 1) & 0xff;
  mem8[SCRIPT_COL_CHECK_TICK] = tick;
  if (tick !== 0) return; // not a checksum frame yet

  // Checksum frame: reseed the timers and run the 14x29 column checksum.
  mem8[SCRIPT_FRAME_TIMER] = 0x96;
  mem8[ATTRACT_SUBSTATE] = 0;
  let ptr = ROUND_TILE_DST;
  let sumLow = 0;
  let carries = 0;
  for (let c = 0; c < CHECK_COLS; c++) {
    for (let r = 0; r < CHECK_ROWS; r++) {
      const raw = sumLow + mem8[ptr];
      if (raw > 0xff) carries = (carries + 1) & 0xff;
      sumLow = raw & 0xff;
      ptr = u16(ptr + 1);
    }
    ptr = u16(ptr + 3); // skip to the next 0x20-aligned column
  }

  let vptr = mem16[INTRO_DELAY_CKSUM_WORD];
  if (sumLow !== mem8[vptr]) return resetToAttractScreenStart(m); // low-byte miss
  vptr = u16(vptr + 1);
  if (carries !== mem8[vptr]) return blankRowThenFloodColorsAndAdvanceAttract(m); // high-byte miss

  mem8[INTRO_DELAY_CKSUM_WORD] = 0; // clean pass: clear the check word
  mem8[INTRO_DELAY_CKSUM_WORD + 1] = 0;
  mem8[MAIN_GAME_STATE] = PLAY_STATE;
  return resetActorStateForBoard(m); // advance to the next screen builder
}
