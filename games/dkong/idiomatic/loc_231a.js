// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_231a — seed one object's toward-player step code and step delta from the
 * horizontal offset to the player (the difficulty-5 arm of object-velocity init).
 * ROM 0x231A.
 *
 * Reached only as the difficulty-5 branch of the object-velocity initialiser: the
 * caller dispatches on (difficulty − 1) and lands here at difficulty 5 (the hardest
 * tier). It fills the same two record fields the difficulty-3/4 arm (loc_2303) does,
 * but derives BOTH from the signed horizontal offset between the player and the object
 * rather than from the random byte:
 *
 *   • step code (record +0x10) ← the offset's top two bits placed in the low end, with
 *     the byte sign-extended by whether the player is left of the object. So the low two
 *     bits carry the offset's magnitude band and the upper bits carry the left/right
 *     sign — a compact direction code that sharpens as the offset grows.
 *   • step delta (record +0x11) ← the offset rotated left two places (its low six bits
 *     shift up and those same top two bits wrap down into the low two).
 *
 * The offset is taken at byte width, and the left/right sign is an UNSIGNED comparison
 * of the two X positions (player X < object X), matching loc_2303's sign — distinct from
 * the offset's own top bit, so the two signals are folded together deliberately.
 *
 * The code is written first, then the delta — the same order as the oracle, though the
 * two writes land in different cells and are independent.
 *
 * The caller supplies the object-record pointer at the oracle boundary (its caller,
 * sub_22cb, is still the frozen oracle and hands the record over in a register), so this
 * reads that pointer from the machine rather than taking it as a promoted parameter;
 * that dissolves once the caller is decompiled.
 *
 * NAME: kept the neutral loc_ — the mechanism is pinned to the oracle, but the two
 * record fields it writes (+0x10 / +0x11) are not yet named in names.js and their "object
 * velocity" reading rests on the still-oracle caller's header alone, below the
 * routine-name evidence bar. Promote once those offsets are corroborated. (Mirrors the
 * sibling loc_2303, which writes the same two fields on the easier difficulties.)
 *
 * Memory-equivalent to the frozen oracle — equivalence-231a.test.js.
 * GATE:     exhaustive — the whole memory effect is a total function of just two input
 *           bytes (player X, object X), so the full 256×256 grid is a PROOF, not a
 *           sample; plus crafted dispatches on a real attract-base machine. 0x231A is a
 *           non-executing frontier in attract (difficulty is 1 there, so the caller takes
 *           the 0x22F6 arm), so there are no natural dispatches to capture. Teeth: a
 *           dropped delta rotate, a signed sign-compare, a weakened sign fill, and
 *           swapped output offsets.
 * LIVE-OUT: memory-only — the caller tail-calls this (its own return is this routine's
 *           return) and consumes only the two record fields written here; the oracle's
 *           residual registers/flags and its terminal return are dead.
 * NAMES:    MARIO_X (0x6203), OBJ_X (record +0x03) — from names.js. The two written fields
 *           (record +0x10 step code, +0x11 step delta) have no names.js offset name yet and
 *           stay local consts here (same offsets the sibling loc_2303 leaves unnamed).
 */

import { u8 } from "../../../core/int.js";
import { MARIO_X, OBJ_X } from "./names.js";

// Object-record fields written here, addressed off the record pointer. Neither has a
// shared OBJ_* offset name in names.js yet (only +0/+3/+5/+7/+8 are named there); the
// sibling loc_2303 writes the same two fields on the easier difficulties.
const OBJ_STEP_DIR = 0x10; // toward-player step code
const OBJ_STEP_MAG = 0x11; // step delta

export function loc_231a(m) {
  const { regs, mem } = m;

  // The caller's object-record pointer (oracle boundary: sub_22cb still supplies it).
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
