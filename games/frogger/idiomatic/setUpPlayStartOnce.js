// SPDX-License-Identifier: GPL-3.0-only
/**
 * setUpPlayStartOnce — the once-per-life start-of-play setup, called from the main loop. Guarded
 * twice: it returns unless the mode byte is 1 (active play) and the run flag is
 * still zero. Only then does it clear the credit-column latch, lay out the board (display field, score
 * field, active-player lane params, frog + arm objects, the home-group tile block, the frog object),
 * run the frog-animation dispatcher (direct call), then raise the 2-player start flag and the
 * run flag so the layout happens exactly once. LIVE-OUT: memory-only.
 */
import { GAME_MODE, INTRO_COUNTER_829B, CREDIT_COLUMN_CLEAR_LATCH, TWO_PLAYER_START_FLAG, STATUS_ROW_VRAM_BASE } from "./names.js";
import { initDisplayFieldOnce } from "./initDisplayFieldOnce.js";
import { clearAndSeedScoreField } from "./clearAndSeedScoreField.js";
import { loadActivePlayerLaneParams } from "./loadActivePlayerLaneParams.js";
import { renderFrogAndArmObjects } from "./renderFrogAndArmObjects.js";
import { blitFourTileGroupColumn } from "./blitFourTileGroupColumn.js";
import { resetFrogObject } from "./resetFrogObject.js";
import { dispatchFrogAnimationArm } from "./dispatchFrogAnimationArm.js";

const MODE_ACTIVE_PLAY = 1;

export function setUpPlayStartOnce(m) {
  const { mem8 } = m;

  if (mem8[GAME_MODE] !== MODE_ACTIVE_PLAY) return;
  if (mem8[INTRO_COUNTER_829B] !== 0) return;

  mem8[CREDIT_COLUMN_CLEAR_LATCH] = 0;

  initDisplayFieldOnce(m);
  clearAndSeedScoreField(m);
  loadActivePlayerLaneParams(m);
  mem8[TWO_PLAYER_START_FLAG] = 0;
  renderFrogAndArmObjects(m);
  blitFourTileGroupColumn(m, STATUS_ROW_VRAM_BASE);
  resetFrogObject(m);
  // The frog-anim dispatcher (ROM 0x0faf) ran under a balanced push16(0x2338)+m.call: the sentinel
  // 0x2338 is this function's own continuation below, and the arm cluster's one net ret consumes it.
  // Dissolved to a direct call -- dropping the seam push only touches dead stack scratch [0x87e0,0x8800).
  dispatchFrogAnimationArm(m);

  mem8[TWO_PLAYER_START_FLAG] = 1;
  mem8[INTRO_COUNTER_829B] = 1;
}
