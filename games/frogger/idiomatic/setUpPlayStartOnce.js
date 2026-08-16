// SPDX-License-Identifier: GPL-3.0-only
/**
 * setUpPlayStartOnce — the once-per-life start-of-play setup, called from the main loop. Guarded
 * twice: it returns unless the mode byte is 1 (active play) and the run flag is
 * still zero. Only then does it clear the credit-column latch, lay out the board (display field, score
 * field, active-player lane params, frog + arm objects, the home-group tile block, the frog object),
 * run the frog-animation dispatcher (kept dispatch), then raise the 2-player start flag and the
 * run flag so the layout happens exactly once. LIVE-OUT: memory-only.
 */
import { GAME_MODE, loc_829b, CREDIT_COLUMN_CLEAR_LATCH, TWO_PLAYER_START_FLAG } from "./names.js";
import { initDisplayFieldOnce } from "./initDisplayFieldOnce.js";
import { clearAndSeedScoreField } from "./clearAndSeedScoreField.js";
import { loadActivePlayerLaneParams } from "./loadActivePlayerLaneParams.js";
import { renderFrogAndArmObjects } from "./renderFrogAndArmObjects.js";
import { blitFourTileGroupColumn } from "./blitFourTileGroupColumn.js";
import { resetFrogObject } from "./resetFrogObject.js";

const MODE_ACTIVE_PLAY = 1;
const HOME_GROUP_VRAM = 0xa850;    // HL live-in for blitFourTileGroupColumn
const FROG_ANIM_DISPATCH = 0x0faf, FROG_ANIM_RET = 0x2338; // jp(hl) dispatcher (kept m.call)

export function setUpPlayStartOnce(m) {
  const { regs, mem8 } = m;

  if (mem8[GAME_MODE] !== MODE_ACTIVE_PLAY) return;
  if (mem8[loc_829b] !== 0) return;

  mem8[CREDIT_COLUMN_CLEAR_LATCH] = 0;

  initDisplayFieldOnce(m);
  clearAndSeedScoreField(m);
  loadActivePlayerLaneParams(m);
  mem8[TWO_PLAYER_START_FLAG] = 0;
  renderFrogAndArmObjects(m);
  regs.hl = HOME_GROUP_VRAM;
  blitFourTileGroupColumn(m);
  resetFrogObject(m);
  m.push16(FROG_ANIM_RET);
  m.call(FROG_ANIM_DISPATCH);

  mem8[TWO_PLAYER_START_FLAG] = 1;
  mem8[loc_829b] = 1;
}
