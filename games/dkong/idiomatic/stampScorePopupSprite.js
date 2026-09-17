// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampScorePopupSprite — commit a 4-byte sprite record into POPUP_SPRITE from three
 * caller-supplied bytes plus a fixed attribute, then, only on the boards whose bit is set
 * in the applicability mask, cue a sound.
 *
 * LIVE-OUT: memory-only — the four POPUP_SPRITE bytes always, plus the sound latch when the
 * board gate is open.
 */
import { boardBitGate } from "./boardBitGate.js";
import { POPUP_SPRITE } from "./names.js";

const SPRITE_ATTR = 0x07;     // record byte +2
const BOARD_MASK = 0x05;      // bit0 25m, bit2 75m
const SOUND_LATCH = 0x6085;   // storing 3 asserts this sound for 3 frames

export function stampScorePopupSprite(m) {
  const { regs, mem8 } = m;

  mem8[POPUP_SPRITE + 0] = regs.a;
  mem8[POPUP_SPRITE + 1] = regs.b;
  mem8[POPUP_SPRITE + 2] = SPRITE_ATTR;
  mem8[POPUP_SPRITE + 3] = regs.c;

  regs.a = BOARD_MASK;
  if (!boardBitGate(m)) return;

  mem8[SOUND_LATCH] = 0x03;
}
