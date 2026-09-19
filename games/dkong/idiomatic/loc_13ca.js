// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_13ca — format a player's packed-BCD score into display digits, then bubble its record up
 * a descending high-score table. Called at game-over with the score pointer in HL and a player
 * tag in A; all writes land in a work-RAM staging area, not the live high-score cell.
 *
 * LIVE-OUT: memory-only — the staging area, and the records below it on each sort pass.
 */

import { u16 } from "../../../core/int.js";
import { gameActiveGuard } from "./gameActiveGuard.js";
import {
  SCORE_SORT_DIGITS,
  SCORE_SORT_STAGING_KEY,
  SCORE_SORT_TABLE_KEY,
  SCORE_SORT_TAG,
} from "./names.js";

// Score-format / sort staging area (file-local; none of these cells carries a shared name).

export function loc_13ca(m, a = m.regs.a, scorePtr = m.regs.hl) {
  const { mem8 } = m;

  mem8[SCORE_SORT_TAG] = a;

  if (!gameActiveGuard(m)) return;

  const src = scorePtr;
  for (let i = 0; i < 3; i++) mem8[SCORE_SORT_STAGING_KEY + i] = mem8[u16(src + i)];

  // Unpack the 3 BCD bytes read back-to-front into 6 nibbles (high then low), MS digit first.
  for (let i = 0; i < 3; i++) {
    const byte = mem8[SCORE_SORT_STAGING_KEY + 2 - i];
    mem8[SCORE_SORT_DIGITS + 2 * i] = (byte >> 4) & 0x0f;
    mem8[SCORE_SORT_DIGITS + 2 * i + 1] = byte & 0x0f;
  }

  // Pad 14 blank tiles (0x10) then a terminator (0x3f): a fixed 21-byte display field.
  for (let i = 0; i < 14; i++) mem8[SCORE_SORT_DIGITS + 6 + i] = 0x10;
  mem8[SCORE_SORT_DIGITS + 6 + 14] = 0x3f;

  // Bubble the new record up a DESCENDING table (up to 5 passes): stop once the new 3-byte
  // little-endian key is smaller than the one above, else swap the two 25-byte records.
  let hl = SCORE_SORT_TABLE_KEY;
  let de = SCORE_SORT_STAGING_KEY;
  for (let pass = 0; pass < 5; pass++) {
    const keyDe =
      mem8[de] | (mem8[u16(de + 1)] << 8) | (mem8[u16(de + 2)] << 16);
    const keyHl =
      mem8[hl] | (mem8[u16(hl + 1)] << 8) | (mem8[u16(hl + 2)] << 16);
    if (keyDe < keyHl) return;

    // Compare left both pointers at key+2; swap 25 bytes downward. The spans never overlap
    // (records sit 34 bytes apart), so the exchange is order-independent.
    for (let k = 0; k < 25; k++) {
      const ah = u16(hl + 2 - k);
      const ad = u16(de + 2 - k);
      const tmp = mem8[ah];
      mem8[ah] = mem8[ad];
      mem8[ad] = tmp;
    }

    // Step both keys back to the next-higher record pair (net −34 each).
    hl = u16(hl - 34);
    de = u16(de - 34);
  }
}
