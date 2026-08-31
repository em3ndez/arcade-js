// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { resetToAttractScreenStart } from "./resetToAttractScreenStart.js";
import { blankRowThenFloodColorsAndAdvanceAttract } from "./blankRowThenFloodColorsAndAdvanceAttract.js";
import { advanceFourObjectAnimsAndRebuildList } from "./advanceFourObjectAnimsAndRebuildList.js";
import { advanceAttractAnimationAndRepaint } from "./advanceAttractAnimationAndRepaint.js";
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { resetActorStateForBoard } from "./resetActorStateForBoard.js";
import {
  HUD_INTEGRITY_STRIP_A,
  ANIM_FRAME_COUNTER,
  SCRIPT_FRAME_TIMER,
  ATTRACT_SUBSTATE,
  SCRIPT_COL_CHECK_TICK,
  SCRIPT_WRITE_PTR,
  INTRO_DELAY_CKSUM_WORD,
  LAUNCH_SEQ_COUNTER,
  ROUND_TILE_DST,
  MAIN_GAME_STATE,
  ATTRACT_SCRIPT_PTR_TABLE,
} from "./names.js";
/**
 * advanceAttractToBoardBuildIfImageIntact — anti-tamper attract sub-state-6 handler, entered when the integrity guard finds the
 * primary copy patched. Verifies the HUD_INTEGRITY_STRIP_A column
 * (each cell equals the one 0x20 above), ticks the ANIM_FRAME_COUNTER / SCRIPT_FRAME_TIMER timers,
 * seats the next script pointer from the attract-script pointer table, column-checksums the
 * ROUND_TILE_DST block, and on a clean checksum clears the intro word/counter, sets
 * MAIN_GAME_STATE=3 and tails to the board reset; any integrity failure tails to the tamper-fail
 * handlers.
 *
 * LIVE-OUT: none (memory only) — a void handler; mismatch/finish paths are tail calls.
 */
export function advanceAttractToBoardBuildIfImageIntact(m) {
  const { mem8, mem16 } = m;

  let hl = HUD_INTEGRITY_STRIP_A;
  for (let b = 0x0a; b > 0; b--) { // column integrity: each cell == the one 0x20 above
    const a = mem8[hl];
    hl = u16(hl - 0x20);
    if (a !== mem8[hl]) return resetToAttractScreenStart(m);
  }

  mem8[ANIM_FRAME_COUNTER] = u8(mem8[ANIM_FRAME_COUNTER] - 1);
  if (mem8[ANIM_FRAME_COUNTER] === 0) advanceAttractAnimationAndRepaint(m);
  advanceFourObjectAnimsAndRebuildList(m);

  mem8[SCRIPT_FRAME_TIMER] = u8(mem8[SCRIPT_FRAME_TIMER] - 1);
  if (mem8[SCRIPT_FRAME_TIMER] !== 0) return;

  mem8[SCRIPT_FRAME_TIMER] = 0x01;
  mem8[ATTRACT_SUBSTATE] = u8(mem8[ATTRACT_SUBSTATE] - 1);
  const idx = u8(mem8[SCRIPT_COL_CHECK_TICK] - 1);
  mem16[SCRIPT_WRITE_PTR] = fetchWordFromTableIndex(m, idx, ATTRACT_SCRIPT_PTR_TABLE);
  mem8[SCRIPT_COL_CHECK_TICK] = u8(mem8[SCRIPT_COL_CHECK_TICK] - 1);
  if (mem8[SCRIPT_COL_CHECK_TICK] !== 0) return;

  mem8[SCRIPT_FRAME_TIMER] = 0x96;
  mem8[ATTRACT_SUBSTATE] = 0;

  let d = 0;
  let e = 0;
  let ptr = ROUND_TILE_DST;
  for (let col = 0x0e; col > 0; col--) { // 14 columns
    for (let row = 0x1d; row > 0; row--) { // 29 rows, running sum in E with overflow into D
      const sum = e + mem8[ptr];
      if (sum > 0xff) d = u8(d + 1);
      e = u8(sum);
      ptr = u16(ptr + 1);
    }
    let ph = ptr >> 8; // step to the next column: l += 3, carry into h
    const pl = (ptr & 0xff) + 0x03;
    if (pl > 0xff) ph = u8(ph + 1);
    ptr = (ph << 8) | (pl & 0xff);
  }

  let check = mem16[INTRO_DELAY_CKSUM_WORD]; // dereference the stored checksum pointer
  if (e !== mem8[check]) return resetToAttractScreenStart(m);
  check = u16(check + 1);
  if (mem8[check] !== d) return blankRowThenFloodColorsAndAdvanceAttract(m);

  mem8[INTRO_DELAY_CKSUM_WORD] = 0;
  mem8[LAUNCH_SEQ_COUNTER] = 0;
  mem8[MAIN_GAME_STATE] = 0x03;
  return resetActorStateForBoard(m); // advance to the next screen builder
}
