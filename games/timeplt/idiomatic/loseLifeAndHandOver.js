// SPDX-License-Identifier: GPL-3.0-only
/** loseLifeAndHandOver — one maintenance step per call: hide the sprite band, start the next round when a
 * flag is set, and queue this frame's fixed sound requests. Then decrement the lives count at the
 * head of the live 16-byte context block and copy that block into whichever of two save slots the
 * active-player selector points at. If lives reached zero, hand off to the game-over banner and
 * stop. Otherwise, when the other player's slot still shows lives, flip the selector, then stamp a
 * constant into one cell and a program-image byte into another. LIVE-OUT: memory. */

import { u8 } from "../../../core/int.js";
import { loc_5634 } from "./loc_5634.js";
import { hideAllSprites } from "./hideAllSprites.js";
import { startNextRound } from "./startNextRound.js";
import { postGameOverBanner } from "./postGameOverBanner.js";
import { ROUND_TRANSITION_HOLD } from "./names.js";

const RECORD = 0xad00;
const SLOT_A = 0xad10;
const SLOT_B = 0xad20;
const SELECTOR = 0xad32;
const RECORD_LEN = 16;

const STAMP_CELL = 0xa9eb;
const STAMP_VALUE = 90;
const IMAGE_TARGET = 0xa9ac;
const IMAGE_BYTE = 0x4b52;

export function loseLifeAndHandOver(m) {
  const { mem8 } = m;

  hideAllSprites(m);
  if (mem8[ROUND_TRANSITION_HOLD] !== 0) startNextRound(m);
  loc_5634(m);

  const count = u8(mem8[RECORD] - 1);
  mem8[RECORD] = count;
  const dest = mem8[SELECTOR] === 0 ? SLOT_A : SLOT_B;
  for (let i = 0; i < RECORD_LEN; i++) mem8[dest + i] = mem8[RECORD + i];
  if (count === 0) return postGameOverBanner(m);

  const other = mem8[SELECTOR] === 0 ? SLOT_B : SLOT_A;
  if (mem8[other] !== 0) mem8[SELECTOR] = (mem8[SELECTOR] + 1) & 1;

  mem8[STAMP_CELL] = STAMP_VALUE;
  mem8[IMAGE_TARGET] = mem8[IMAGE_BYTE];
}
