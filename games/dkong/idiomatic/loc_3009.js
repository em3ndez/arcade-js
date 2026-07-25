// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_3009 — bit-field lookup over a packed 4x2-bit table, keyed by an input
 * byte and a 2-bit selector. ROM 0x3009.
 *
 * A leaf, PURE over its two register-byte inputs (a = A, b = B): it reads no
 * memory, writes no memory, and calls nothing. Mechanically:
 *
 *   1. SELECT a packed byte C from three bits of `a`. Bit 0 of `a` picks a
 *      family (clear -> {0x90, 0x6c}, set -> {0xb4, 0x1e}); bit 2 of `a` picks
 *      within the family. Each of 0x6c/0xb4/0x1e is a permutation of {0,1,2,3}
 *      across its four 2-bit fields; 0x90 (= 0x93 & 0xf0) is the odd one out,
 *      fields {0,0,1,2} — it lacks a 3, which is the only source of the hang below.
 *   2. On the bit-0-set family only, if bit 2 of `b` is set, decrement `b`.
 *      Call the resulting selector `bEff`.
 *   3. SCAN C's four 2-bit fields for one equal to `bEff`, by rotating C right
 *      two bits at a time until its low two bits == bEff. Because ror-by-2 has
 *      period 4, this visits all four fields. FAITHFUL NON-TERMINATION: if no
 *      field equals bEff — always the case when bEff > 3, and when bEff == 3
 *      with C == 0x90 — the ROM loops forever, so this does too (no guard added;
 *      a cap would silently turn the hang into a wrong terminating result).
 *   4. EXIT on the field AFTER the match. Let `next` = the next 2-bit field.
 *      - next != 3  -> return A = next, CARRY set (next < 3 always here).
 *      - next == 3  -> clear bit 2 of the ORIGINAL input (`d`), decrement it;
 *                      if still nonzero return A = 3, else return A = 0x04.
 *                      CARRY clear on both (the `cp 0x03` equal path; dec keeps C).
 *
 * The constants' game meaning (what 0x6c/0xb4/0x1e/0x90 encode, why the three
 * untranslated call sites 0x1C9E/0x1CBA/0x23F4 want it) is NOT established, so
 * the routine keeps its address name rather than a guessed English one.
 *
 * Modelled as a pure function of (a, b) because it touches no memory: the test
 * compares its result against the oracle's resulting registers directly (as the
 * snapYToGirder leaf does), so there is no stack/pc/SP to model — the Z80 `ret`
 * is just this function returning.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3009.test.js.
 * GATE:     exhaustive over the TERMINATING (a,b) domain (all 65,536 combos,
 *           the non-terminating ones skipped by an independent predicate) — a
 *           pure total function on its terminating inputs. UNWIRED: 0x3009 is
 *           not in the dispatch registry (its callers are the untranslated 1977
 *           subtree), so attract never dispatches it; there are no real captured
 *           dispatches and the gate is exhaustive-crafted, not capture-based.
 * LIVE-OUT: memory-only (writes NO RAM) + register A + the CARRY flag (0x23F7
 *           reads carry with `rra`). b/c/d are reproduced faithfully and checked
 *           by the test as free teeth, but are NOT a liveness claim — no
 *           translated successor is available to confirm they are read.
 * NAMES:    none — pure arithmetic on register inputs; references no RAM address.
 *
 * @param {number} a  the input byte (Z80 A), 0..255.
 * @param {number} b  the 2-bit selector (Z80 B), 0..255.
 * @returns {{a:number, carry:boolean, b:number, c:number, d:number}} the register
 *   file at `ret`: a = result in A, carry = the carry flag, b/c/d as left by the
 *   routine. Does not return for a non-terminating (a,b) (it loops, like the ROM).
 */
export function loc_3009(a, b) {
  const ror2 = (v) => ((v >> 2) | (v << 6)) & 0xff; // 8-bit rotate right by 2 (two `rrca`)

  const d = a; // `ld d,a` — the original input, kept for the exit test
  let bEff = b;
  let c;

  if ((a & 0x01) === 0) {
    // bit 0 clear: C = 0x93 with a `& 0xf0` unless bit 2 of `a` steers to 0x6c.
    // (0x93 & 0xf0 = 0x90; the `rlca` carry that gates the `& 0xf0` is bit 2 of a.)
    c = (a & 0x04) ? 0x6c : 0x90;
  } else {
    // bit 0 set: C = 0xb4, or 0x1e when bit 2 of `a` is set.
    c = (a & 0x04) ? 0x1e : 0xb4;
    // `bit 2,b` then `dec b`: only this family adjusts the selector.
    if (b & 0x04) bEff = (b - 1) & 0xff;
  }

  // Rotate C right two bits per pass; stop when its low two bits equal bEff.
  // Loops forever if no 2-bit field of C equals bEff — faithful to the ROM.
  for (;;) {
    c = ror2(c);
    if ((c & 0x03) === bEff) break;
  }

  // The field AFTER the match decides the exit.
  const next = ror2(c) & 0x03;
  if (next !== 3) {
    // `cp 0x03` with next < 3 sets carry; A = next.
    return { a: next, carry: true, b: bEff, c, d };
  }

  // next == 3: carry is clear (equal), and `res 2,d` / `dec d` neither touch it.
  const d2 = ((d & ~0x04) - 1) & 0xff;
  if (d2 !== 0) return { a: 3, carry: false, b: bEff, c, d: d2 };
  return { a: 0x04, carry: false, b: bEff, c, d: d2 };
}
