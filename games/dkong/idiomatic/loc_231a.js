// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_231a — seed one object's toward-player step code and step delta from the
 * horizontal offset to the player (the difficulty-5 arm of object-velocity init).
 *
 * Reached only as the difficulty-5 branch of the object-velocity initialiser: the
 * caller dispatches on (difficulty − 1) and lands here at difficulty 5 (the hardest
 * tier). It fills the same two record fields the difficulty-3/4 arm does, but derives
 * BOTH from the signed horizontal offset between the player and the object rather than
 * from the random byte:
 *
 *   • step code (record +0x10) ← the offset's top two bits placed in the low end, with
 *     the byte sign-extended by whether the player is left of the object. So the low two
 *     bits carry the offset's magnitude band and the upper bits carry the left/right
 *     sign — a compact direction code that sharpens as the offset grows.
 *   • step delta (record +0x11) ← the offset rotated left two places (its low six bits
 *     shift up and those same top two bits wrap down into the low two).
 *
 * The offset is taken at byte width, and the left/right sign is an UNSIGNED comparison
 * of the two X positions (player X < object X), matching the sibling arm's sign — distinct
 * from the offset's own top bit, so the two signals are folded together deliberately.
 *
 * The code is written first, then the delta, though the two writes land in different cells
 * and are independent.
 *
 * The object-record pointer arrives from the caller in the index register, so this routine
 * reads it off the machine rather than taking it as a parameter.
 *
 * WHY THE NEUTRAL NAME: the mechanism is exact, but the two record fields it writes carry no
 * shared name, and the "object velocity" reading of them is not corroborated inside this
 * routine — so an English name would assert more than this file establishes.
 *
 * LIVE-OUT: memory-only — the caller consumes only the two record fields written here.
 */

import { u8 } from "../../../core/int.js";
import { MARIO_X, OBJ_X } from "./names.js";

// Object-record fields written here, addressed off the record pointer. Neither carries a
// shared OBJ_* offset name; the easier-difficulty arm writes the same two fields.
const OBJ_STEP_DIR = 0x10; // toward-player step code
const OBJ_STEP_MAG = 0x11; // step delta

export function loc_231a(m) {
  const { regs, mem } = m;

  // The caller's object-record pointer, handed over in the index register.
  const objBase = regs.ix;

  const playerX = mem.read8(MARIO_X);
  const objX = mem.read8((objBase + OBJ_X) & 0xffff);

  // Signed horizontal offset from the object to the player, taken at byte width; its
  // top two bits feed BOTH output fields.
  const offset = u8(playerX - objX);
  const topTwoBits = offset >> 6; // bits 7 and 6 of the offset, as a 0..3 value

  // Step code (record +0x10): the offset's top two bits in the low end, sign-extended by
  // whether the player is left of the object — 0xFC fills the upper six bits when left
  // (an unsigned X compare), nothing when at or to the right.
  mem.write8((objBase + OBJ_STEP_DIR) & 0xffff, (playerX < objX ? 0xfc : 0x00) | topTwoBits);

  // Step delta (record +0x11): the offset rotated left two places — the low six bits move
  // up and those same top two bits wrap down into the low two. The store truncates the
  // shifted-out high bits.
  mem.write8((objBase + OBJ_STEP_MAG) & 0xffff, (offset << 2) | topTwoBits);
}
