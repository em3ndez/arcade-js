// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_13ca — format a packed-BCD score into display digits, then bubble a 3-byte-keyed
 * record up a descending table.
 *
 * Reached only at a player's game-over — the last life lost. The caller hands over that
 * player's three-byte packed-BCD score and a one-byte player tag (1 for player 1, 3 for
 * player 2). Everything written lands in a work-RAM staging area, which is NOT the live
 * high-score cell. It does three things:
 *
 *   1. Stash the player tag, then take a caller-skip guard: in attract it aborts here,
 *      having written only that one byte.
 *   2. Copy the three packed-BCD score bytes into the staging area and UNPACK them into six
 *      display digit-nibbles, most-significant BCD pair first — the three bytes are read
 *      back-to-front, and each is split high nibble then low — then pad fourteen blank tiles
 *      and a terminator, making a fixed-width 21-byte display field.
 *   3. A bubble/insertion pass over a DESCENDING table: up to five iterations, each a
 *      three-byte little-endian key compare. While the new key (initially the raw score just
 *      copied) is NOT smaller than the key above it, swap the two 25-byte records and step
 *      both keys back 34 bytes to the next-higher pair; the first time the new key IS smaller
 *      it stops, having found its slot.
 *
 * The nibble split is an explicit swap, not a loop; the multi-byte borrow chain is a 24-bit
 * unsigned compare, rendered here as a plain numeric less-than.
 *
 * LIVE-OUT: memory-only — the staging area, and the records below it on each sort pass.
 */

import { gameActiveGuard } from "./gameActiveGuard.js";

// Score-format / sort staging area. None of these cells carries a shared name, so they are
// file-local here.
const PARAM_SLOT = 0x61c6; // the player tag is stored here
const RAW_SCORE = 0x61c7;  // 3 packed-BCD score bytes copied here; also the sort's first "new" key
const DIGITS = 0x61b1;     // 6 unpacked digit nibbles written forward from here
const TABLE_KEY = 0x61a5;  // the sort's first "record above" key

export function loc_13ca(m) {
  const { mem, regs } = m;

  // Stash the caller's player tag (1 for player 1, 3 for player 2).
  mem.write8(PARAM_SLOT, regs.a);

  // Caller-skip guard: in attract, abort here — only the player tag has been written.
  if (!gameActiveGuard(m)) return;

  // Copy the caller's 3-byte packed-BCD score into the staging area.
  const src = regs.hl;
  for (let i = 0; i < 3; i++) mem.write8(RAW_SCORE + i, mem.read8((src + i) & 0xffff));

  // BCD unpack (x3): the three copied bytes are read BACK-TO-FRONT, most-significant BCD
  // pair first, each split into its two digit nibbles — high then low — and written forward,
  // so the six digits land most-significant-first.
  for (let i = 0; i < 3; i++) {
    const byte = mem.read8(RAW_SCORE + 2 - i); // last copied byte first
    mem.write8(DIGITS + 2 * i, (byte >> 4) & 0x0f); // high nibble
    mem.write8(DIGITS + 2 * i + 1, byte & 0x0f);    // low nibble
  }

  // Pad the field: 14 blank tiles then a terminator — a fixed 21-byte display record.
  for (let i = 0; i < 14; i++) mem.write8(DIGITS + 6 + i, 0x10);
  mem.write8(DIGITS + 6 + 14, 0x3f);

  // Bubble the new record up a DESCENDING table: up to 5 passes. Each pass compares the
  // 3-byte little-endian key of the new record (initially the raw score just copied) against
  // the key of the record above it. If the new key is smaller it has found its slot and
  // stops; otherwise it swaps the two 25-byte records and steps both keys back 34 bytes to
  // the next-higher pair.
  let hl = TABLE_KEY;
  let de = RAW_SCORE;
  for (let pass = 0; pass < 5; pass++) {
    // 3-byte little-endian compare, as a borrow chain: it borrows — and so stops — exactly
    // when the new key is unsigned-less-than the key above it.
    const keyDe =
      mem.read8(de) | (mem.read8((de + 1) & 0xffff) << 8) | (mem.read8((de + 2) & 0xffff) << 16);
    const keyHl =
      mem.read8(hl) | (mem.read8((hl + 1) & 0xffff) << 8) | (mem.read8((hl + 2) & 0xffff) << 16);
    if (keyDe < keyHl) return; // slot found, stop.

    // Swap the two 25-byte records: the compare left both pointers at their key's last byte
    // (+2, since only two of the three subtraction steps advance), and the swap runs from
    // there down 25 bytes. The two spans never overlap — the new record sits 34 bytes above
    // the one above it — so the exchange is order-independent.
    for (let k = 0; k < 25; k++) {
      const ah = (hl + 2 - k) & 0xffff;
      const ad = (de + 2 - k) & 0xffff;
      const tmp = mem.read8(ah);
      mem.write8(ah, mem.read8(ad));
      mem.write8(ad, tmp);
    }

    // Step both keys back to the next-higher record pair: net −34 each, being +2 across the
    // compare, −25 across the swap and −11 to rewind.
    hl = (hl - 34) & 0xffff;
    de = (de - 34) & 0xffff;
  }
  // Fell through all 5 passes without finding a smaller key.
}
