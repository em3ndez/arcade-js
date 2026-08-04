// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_13ca — format a packed-BCD score into display digits, then bubble a
 * 3-byte-keyed record up a descending table.  ROM 0x13CA.
 *
 * Reached only at a player's game-over (last life lost): the two callers
 * loc_12f2 (idx 14) and loc_1344 (idx 15) decrement LIVES, and on the zero
 * branch call this with HL = the finished player's 3-byte packed-BCD score
 * (P1_SCORE 0x60B2 with A=0x01, P2_SCORE 0x60B5 with A=0x03). It does three things
 * into the 0x61A5..0x61CA work-RAM staging area (deliberately unnamed in names.js —
 * NOT the live HIGH_SCORE at 0x60B8):
 *
 *   1. Stash the A parameter at 0x61C6, then a `rst 0x08` caller-skip guard: in
 *      attract (ATTRACT bit 0 set) it aborts here, having written only that byte.
 *   2. Copy the 3 packed-BCD score bytes to 0x61C7..0x61C9, and UNPACK them into
 *      six display digit-nibbles at 0x61B1.., most-significant BCD pair first
 *      (0x61C9,0x61C8,0x61C7 read back-to-front; high nibble via `rrca x4 + and 0x0f`,
 *      low via re-read + `and 0x0f`), then pad 14 blank tiles (0x10) and a 0x3F
 *      terminator — a fixed-width 21-byte display field.
 *   3. A bubble/insertion pass over a DESCENDING table: up to 5 iterations, each a
 *      3-byte little-endian key compare (the multi-precision `sub/sbc/sbc`). While
 *      the new key (initially the raw score at 0x61C7) is NOT smaller than the key
 *      above it (initially 0x61A5) it swaps the two 25-byte records and steps both
 *      keys back 33 bytes to the next-higher pair; the first time the new key is
 *      smaller it stops (`ret c`), having found its slot.
 *
 * The four `rrca` are an explicit nibble-swap (not a loop); the `sub/sbc/sbc`
 * borrow chain is a 24-bit unsigned compare, faithfully rendered as `keyDe < keyHl`.
 *
 * NAME kept neutral loc_13ca on purpose: the MECHANISM is fully understood, but the
 * 0x61A5..0x61CA staging table is deliberately unnamed scratch in names.js and is not
 * the live HIGH_SCORE, so an English name (e.g. "rankScoreEntry") would over-assert
 * the destination's game-semantic identity past the proposer!=confirmer bar. Promote
 * only once that region is confirmed in names.js.
 *
 * Memory-equivalent to the frozen oracle — equivalence-13ca.test.js.
 * GATE:     crafted-entry — 0x13ca is never dispatched in attract or a brief
 *           coin+start run (it needs a game-over, last life), so a real attract-base
 *           machine is poked to each arm: ATTRACT=1 skip (both players), and ATTRACT=0
 *           full body across score/table seedings that exercise the immediate-`ret c`,
 *           single-swap, and multi-pass sort paths (P1 and P2). Full oracle run both
 *           sides; teeth = a low-nibble-first unpack twin AND a swapped-compare twin.
 * LIVE-OUT: memory-only — all writes land in 0x61A5..0x61CA (and, per sort pass, the
 *           records below it). Reached via `call`, whose caller reloads nothing from
 *           this routine's residual registers/flags; the oracle touches the stack only
 *           through its `rst 0x08` guard and terminal `ret` (net one caller-return pop
 *           on every exit — normal, guard-skip, and `ret c`), so pc/SP carry no residue
 *           and the harness supplies the single matching ret.
 * NAMES:    ATTRACT (0x6007) via gameActiveGuard; the 0x61xx staging addresses are
 *           deliberately unnamed scratch in names.js and stay hex.
 */

import { gameActiveGuard } from "./gameActiveGuard.js";

// Score-format / sort staging area — all deliberately unnamed in names.js, kept hex.
const PARAM_SLOT = 0x61c6; // the A parameter is stored here (`ld (de),a`)
const RAW_SCORE = 0x61c7;  // 3 packed-BCD score bytes copied here; also the sort's first "new" key
const DIGITS = 0x61b1;     // 6 unpacked digit nibbles written forward from here
const TABLE_KEY = 0x61a5;  // the sort's first "record above" key

export function loc_13ca(m) {
  const { mem, regs } = m;

  // ld de,0x61c6 / ld (de),a — stash the caller's A parameter (0x01 P1, 0x03 P2).
  mem.write8(PARAM_SLOT, regs.a);

  // rst 0x08 — caller-skip guard: in attract, abort here (only PARAM_SLOT written).
  if (!gameActiveGuard(m)) return;

  // inc de / ld bc,3 / ldir — copy the caller's 3-byte packed-BCD score
  // (HL = P1_SCORE 0x60B2 / P2_SCORE 0x60B5) into 0x61C7..0x61C9.
  const src = regs.hl;
  for (let i = 0; i < 3; i++) mem.write8(RAW_SCORE + i, mem.read8((src + i) & 0xffff));

  // BCD unpack (x3): the three copied bytes are read back-to-front (0x61C9, 0x61C8,
  // 0x61C7 = most-significant BCD pair first), each split into its two digit
  // nibbles — high (rrca x4 + and 0x0f) then low (re-read + and 0x0f) — written
  // forward from 0x61B1, so the six digits land most-significant-first.
  for (let i = 0; i < 3; i++) {
    const byte = mem.read8(RAW_SCORE + 2 - i); // 0x61C9, then 0x61C8, then 0x61C7
    mem.write8(DIGITS + 2 * i, (byte >> 4) & 0x0f); // high nibble
    mem.write8(DIGITS + 2 * i + 1, byte & 0x0f);    // low nibble
  }

  // Pad the field: 14 blank tiles (0x10) at 0x61B7..0x61C4, then a 0x3F terminator
  // at 0x61C5 — a fixed 21-byte display record starting at 0x61B1.
  for (let i = 0; i < 14; i++) mem.write8(DIGITS + 6 + i, 0x10);
  mem.write8(DIGITS + 6 + 14, 0x3f); // 0x61C5

  // Bubble the new record up a DESCENDING table: up to 5 passes. Each pass compares
  // the 3-byte little-endian key at `de` (the new record, initially the raw score at
  // 0x61C7) against the key at `hl` (the record above, initially 0x61A5). If the new
  // key is smaller it has found its slot and stops; otherwise it swaps the two
  // 25-byte records and steps both keys back 33 bytes to the next-higher pair.
  let hl = TABLE_KEY; // 0x61A5
  let de = RAW_SCORE; // 0x61C7
  for (let pass = 0; pass < 5; pass++) {
    // 3-byte little-endian compare (the `sub/sbc/sbc` borrow chain): borrow — and so
    // `ret c` — exactly when the new key is unsigned-less-than the key above it.
    const keyDe =
      mem.read8(de) | (mem.read8((de + 1) & 0xffff) << 8) | (mem.read8((de + 2) & 0xffff) << 16);
    const keyHl =
      mem.read8(hl) | (mem.read8((hl + 1) & 0xffff) << 8) | (mem.read8((hl + 2) & 0xffff) << 16);
    if (keyDe < keyHl) return; // ret c — slot found, stop.

    // Swap the two 25-byte records: the compare left both pointers at their key's
    // last byte (hl+2 / de+2 — only two of the three sbc steps advance), and the
    // swap runs from there down 25 bytes. The two spans never overlap (de sits 34
    // bytes above hl), so the exchange is order-independent.
    for (let k = 0; k < 25; k++) {
      const ah = (hl + 2 - k) & 0xffff;
      const ad = (de + 2 - k) & 0xffff;
      const tmp = mem.read8(ah);
      mem.write8(ah, mem.read8(ad));
      mem.write8(ad, tmp);
    }

    // Step both keys back to the next-higher record pair (net -34 each: +2 across
    // the compare, -25 across the swap, -11 rewind, via the oracle's ex-de-hl dance).
    hl = (hl - 34) & 0xffff;
    de = (de - 34) & 0xffff;
  }
  // Fell through all 5 passes without a smaller key — the oracle's terminal `ret`.
}
