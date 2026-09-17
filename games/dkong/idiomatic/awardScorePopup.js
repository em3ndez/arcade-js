// SPDX-License-Identifier: GPL-3.0-only
/**
 * awardScorePopup — award points and stage the floating score glyph over Mario, then ping the
 * award sound on the two boards whose bit is set in the board mask.
 *
 * LIVE-OUT: memory-only — the task ring and its tail, the four sprite bytes, and (on the sound arm
 * only) the award sound latch.
 */

import { MARIO_X, MARIO_Y, SPRITE_BUFFER, SND_TRIGGER } from "./names.js";
import { enqueueTask } from "./enqueueTask.js";
import { boardBitGate } from "./boardBitGate.js";

const POPUP_SPRITE = SPRITE_BUFFER + 0x130;
const POPUP_Y_OFFSET = 0x14;
const SOUND_BOARD_MASK = 0x05; // bit0 = 25m, bit2 = 75m
const AWARD_SOUND = SND_TRIGGER + 5;
const SND_ASSERT_FRAMES = 3;
const SPRITE_ATTR = 0x07;

export function awardScorePopup(m, b = m.regs.b) {
  const { regs, mem8 } = m;

  enqueueTask(m);

  const popupY = (mem8[MARIO_Y] + POPUP_Y_OFFSET) & 0xff;
  mem8[POPUP_SPRITE + 0] = mem8[MARIO_X];
  mem8[POPUP_SPRITE + 1] = b;
  mem8[POPUP_SPRITE + 2] = SPRITE_ATTR;
  mem8[POPUP_SPRITE + 3] = popupY;

  regs.a = SOUND_BOARD_MASK;
  if (!boardBitGate(m)) return;
  mem8[AWARD_SOUND] = SND_ASSERT_FRAMES;
}
