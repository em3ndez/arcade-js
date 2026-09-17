// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2303 — on the two hardest difficulties, give one object a random speed and point it at the
 * player: step magnitude <- the random byte, step direction <- the sign that steers toward the
 * player along X. The record pointer arrives in the index register.
 *
 * LIVE-OUT: memory-only — the two record fields.
 */

import { RANDOM, MARIO_X, OBJ_X } from "./names.js";

const OBJ_STEP_DIR = 0x10; // 0x01 = toward-right, 0xFF = toward-left
const OBJ_STEP_MAG = 0x11;

export function loc_2303(m) {
  const { regs, mem8 } = m;

  const objBase = regs.ix;

  mem8[(objBase + OBJ_STEP_MAG) & 0xffff] = mem8[RANDOM];

  const playerLeftOfObject = mem8[MARIO_X] < mem8[(objBase + OBJ_X) & 0xffff];
  mem8[(objBase + OBJ_STEP_DIR) & 0xffff] = playerLeftOfObject ? 0xff : 0x01;
}
