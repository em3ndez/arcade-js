// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_231a — the difficulty-5 arm of object-velocity init: seed the object's step code and step
 * delta from the signed horizontal offset to the player. The step code takes the offset's top
 * two bits in the low end, sign-extended by whether the player is left of the object (unsigned X
 * compare); the step delta is the offset rotated left two places. The record is at regs.ix.
 *
 * LIVE-OUT: memory-only — the caller consumes only the two record fields written here.
 */

import { u8 } from "../../../core/int.js";
import { MARIO_X, OBJ_X } from "./names.js";

const OBJ_STEP_DIR = 0x10; // toward-player step code
const OBJ_STEP_MAG = 0x11; // step delta

export function loc_231a(m) {
  const { regs, mem8 } = m;

  const objBase = regs.ix;

  const playerX = mem8[MARIO_X];
  const objX = mem8[(objBase + OBJ_X) & 0xffff];

  const offset = u8(playerX - objX);
  const topTwoBits = offset >> 6;

  mem8[(objBase + OBJ_STEP_DIR) & 0xffff] = (playerX < objX ? 0xfc : 0x00) | topTwoBits;
  mem8[(objBase + OBJ_STEP_MAG) & 0xffff] = (offset << 2) | topTwoBits;
}
