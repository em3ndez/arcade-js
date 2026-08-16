// SPDX-License-Identifier: GPL-3.0-only
/**
 * initInPlayBoardOnce — one-shot in-play board setup, guarded by a once-per-board flag so it runs once
 * per board. Clears the two players' difficulty indices and two board-state cells, marks the guard,
 * runs the lane/object/field setup, seeds two object cells, then blits the HUD strings and the
 * score-target digits. LIVE-OUT: memory-only.
 */
import {
  IN_PLAY_BOARD_INIT_GUARD, PLAYER1_DIFFICULTY_INDEX, PLAYER2_DIFFICULTY_INDEX,
  TWO_PLAYER_START_FLAG, ANIM_FRAME_INDEX, IN_PLAY_BOARD_STATE_BYTE, INTRO_COUNTER_801B, POINT_TABLE_SPRITE_ATTR_8029,
} from "./names.js";
import { loadActivePlayerLaneParams } from "./loadActivePlayerLaneParams.js";
import { clearActivePlayerWorkRam } from "./clearActivePlayerWorkRam.js";
import { activateFrogObject } from "./activateFrogObject.js";
import { fillTilemapBlock28x32 } from "./fillTilemapBlock28x32.js";
import { clearObjectBlocksAndMirrorToObjRam } from "./clearObjectBlocksAndMirrorToObjRam.js";
import { copyRunUpTileColumn } from "./copyRunUpTileColumn.js";
import { blitPlayerSelectPrompt } from "./blitPlayerSelectPrompt.js";
import { writeScoreField } from "./writeScoreField.js";

export function initInPlayBoardOnce(m) {
  const { regs, mem8 } = m;

  clearActivePlayerWorkRam(m);

  if (mem8[IN_PLAY_BOARD_INIT_GUARD] !== 0) return;

  mem8[PLAYER1_DIFFICULTY_INDEX] = 0;
  mem8[PLAYER2_DIFFICULTY_INDEX] = 0;
  m.mem16[ANIM_FRAME_INDEX] = 0;
  mem8[TWO_PLAYER_START_FLAG] = 0;
  mem8[IN_PLAY_BOARD_STATE_BYTE] = 0;
  mem8[IN_PLAY_BOARD_INIT_GUARD] = 1;

  loadActivePlayerLaneParams(m);
  activateFrogObject(m);
  fillTilemapBlock28x32(m);
  clearObjectBlocksAndMirrorToObjRam(m);

  mem8[INTRO_COUNTER_801B] = 0x04;
  mem8[POINT_TABLE_SPRITE_ATTR_8029] = 0x06;

  regs.hl = 0xaa28; regs.de = 0x2f77; regs.b = 0x04;
  copyRunUpTileColumn(m);
  regs.hl = 0xaaad; regs.e = (regs.e + 1) & 0xff; regs.b = 0x0c; // e advanced by the blit
  copyRunUpTileColumn(m);

  blitPlayerSelectPrompt(m);

  regs.hl = 0xab74; regs.de = 0x2f88; regs.b = 0x03;
  copyRunUpTileColumn(m);
  regs.de = 0x2fa8; regs.b = 0x06; // hl carries from the prior blit
  copyRunUpTileColumn(m);
  regs.de = 0x2fae; regs.b = 0x05;
  copyRunUpTileColumn(m);
  regs.de = (regs.de + 1) & 0xffff; regs.b = 0x07;
  copyRunUpTileColumn(m);

  regs.hl = 0xa994; regs.de = m.mem16[0x2e08];
  writeScoreField(m);

  regs.de = 0x2fba; regs.b = 0x04; // hl carries from the score field
  copyRunUpTileColumn(m);
}
