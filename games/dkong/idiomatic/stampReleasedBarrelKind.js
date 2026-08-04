// SPDX-License-Identifier: GPL-3.0-only
/**
 * stampReleasedBarrelKind — preset a freshly-claimed girder-board barrel record's sprite fields,
 * then fall into the frame-gated string/sprite renderer.
 *
 * Entered with the object-record base in the index register — the record the barrel-release path
 * has just claimed — and stamps three of that record's fields with one of two presets, chosen by
 * bit 7 of BARREL_CLAIM_MODE:
 *   - bit 7 CLEAR -> the default triple: sprite code 0x15, sprite attribute 0x0B, mode 0x00.
 *   - bit 7 SET   -> the alternate triple: sprite code 0x19, sprite attribute 0x0C, mode 0x01.
 * Then it falls straight through into the frame-gated renderer tick.
 *
 * THE TWO PRESETS ARE TWO BARREL KINDS, told apart by watching them on a live playfield:
 *   - the DROPPING kind (bit 7 SET, attribute 0x0C): its sprite code walks 0x19 -> 0x1A -> 0x1B
 *     and it descends with its X PINNED — a straight vertical fall down one column.
 *   - the ROLLING kind (bit 7 CLEAR, attribute 0x0B): sprite code in the 0x15 / 0x16 / 0x17 family,
 *     X sweeping along the girders while Y creeps down.
 *   The two kinds COEXIST — both can be active at once — and the differing attribute byte selects
 *   a different palette, so they are visually distinct too.
 *
 * HONESTY BOUND: which NAMED Donkey Kong object either kind is has not been established. This
 * header says only "the rolling kind" and "the dropping kind", and asserts nothing beyond the
 * observed behaviour.
 *
 * The hardware sequence writes the default triple UNCONDITIONALLY and then, on the bit-7-set arm,
 * overwrites all three; the memory-observable result is exactly one preset per arm, so this
 * collapses to a single branch that writes the selected preset. (These are plain work-RAM record
 * fields, so writing a cell once versus writing-then-overwriting it leaves the identical byte.)
 *
 * WHAT THE NAME DOES NOT CLAIM. It does not claim this routine RELEASES a barrel — the caller does
 * the slot claim — nor that it renders one; that is the renderer tail it falls into. Only that it
 * stamps the appearance of a barrel already released, and that which appearance comes from
 * BARREL_CLAIM_MODE bit 7.
 *
 * LIVE-OUT: memory-only. The caller reads no register this leaves behind.
 */

import { BARREL_CLAIM_MODE, OBJ_SPRITE_CODE, OBJ_SPRITE_ATTR } from "./names.js";
import { advanceBarrelRelease } from "./advanceBarrelRelease.js";

export function stampReleasedBarrelKind(m) {
  const { regs, mem } = m;

  const obj = regs.ix; // barrel record base, handed over by the caller

  // Choose the barrel kind by bit 7 of the slot-claim mode byte and stamp the record's
  // sprite-code, sprite-attr and mode fields.
  if ((mem.read8(BARREL_CLAIM_MODE) & 0x80) === 0) {
    // The ROLLING kind: attribute 0x0B, X sweeps along the girders.
    mem.write8((obj + OBJ_SPRITE_CODE) & 0xffff, 0x15); // sprite-code field
    mem.write8((obj + OBJ_SPRITE_ATTR) & 0xffff, 0x0b); // sprite-attr field
    mem.write8((obj + 0x15) & 0xffff, 0x00); // mode field (no shared name)
  } else {
    // The DROPPING kind: attribute 0x0C, descends with X pinned.
    mem.write8((obj + OBJ_SPRITE_CODE) & 0xffff, 0x19); // sprite-code field
    mem.write8((obj + OBJ_SPRITE_ATTR) & 0xffff, 0x0c); // sprite-attr field
    mem.write8((obj + 0x15) & 0xffff, 0x01); // mode field (no shared name)
  }

  // Fall straight into the frame-gated renderer tick.
  return advanceBarrelRelease(m);
}
