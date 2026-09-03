// SPDX-License-Identifier: GPL-3.0-only
import { drawSpriteList } from "./drawSpriteList.js";
import { drawSprite8x8 } from "./drawSprite8x8.js";
import { currentPlayerRecordPtr } from "./currentPlayerRecordPtr.js";
import { drawScoreRecord } from "./drawScoreRecord.js";
import { clearScreenStrip } from "./clearScreenStrip.js";
import { ACTIVE_PLAYER_PAGE, FRAME_DELAY_TIMER, loc_1b70, loc_2b11, loc_3711, loc_271c, loc_391c } from "./names.js";

// Round-start splash: paint the fixed sprite row, add one more sprite for the player-2 select, then hold
// for 0xb0 displayed frames, drawing each frame while the counter drains. On frames where the counter's
// bit 2 is set the score strip is blanked, otherwise the active player's score is repainted -- so the
// score flashes as the counter counts down. Each pass yields one frame; the interrupt drains the counter.
// Generator; memory + IO.
export function* loc_088d(m) {
  drawSpriteList(m, loc_1b70, 0x0e, loc_2b11);
  if (!(m.mem8[ACTIVE_PLAYER_PAGE] & 1)) drawSprite8x8(m, 0x1c, loc_3711);
  m.mem8[FRAME_DELAY_TIMER] = 0xb0;
  while (m.mem8[FRAME_DELAY_TIMER] !== 0) {
    if (m.mem8[FRAME_DELAY_TIMER] & 0x04) {
      const addr = (m.mem8[ACTIVE_PLAYER_PAGE] & 1) ? loc_271c : loc_391c;
      clearScreenStrip(m, 0x20, addr);
    } else {
      drawScoreRecord(m, currentPlayerRecordPtr(m));
    }
    yield;
  }
}
