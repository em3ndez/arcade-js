// SPDX-License-Identifier: GPL-3.0-only
/**
 * nextAnimationStep — bit-field lookup over a packed 4x2-bit table, keyed by an input
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
 * The constants' game meaning (what 0x6c/0xb4/0x1e/0x90 encode individually) is still
 * NOT established, and the name does not claim it. What the name asserts is the role
 * every call site puts the RESULT to: each one stores it into a byte that decides what is
 * DRAWN. walkMarioRight (ROM 0x1CA4) and walkMarioLeft (ROM 0x1CC0) store it straight into
 * MARIO_WALK_ANIM, whose low two bits become Mario's sprite tile code every frame; the
 * object-orientation refresher takes bits 1 and 0 as an object's two sprite mirror bits;
 * loc_18c6 ORs 0x20 in and stores it as a sprite-object byte. ram.js grounds
 * MARIO_WALK_ANIM live and independently — value set {0,1,2,4}, which is exactly this
 * function's reachable range minus the unreached 3, written ONLY by the two walk routines,
 * at exactly the two instructions that store this function's A. That pins the result as an
 * animation index rather than a direction or a flag word. The name stays a NOUN because
 * the function is PURE — it writes nothing; the callers perform the mutation.
 *
 * Modelled as a pure function of (a, b) because it touches no memory: the test
 * compares its result against the oracle's resulting registers directly (as the
 * snapYToGirder leaf does), so there is no stack/pc/SP to model — the Z80 `ret`
 * is just this function returning.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3009.test.js.
 * GATE:     exhaustive over the TERMINATING (a,b) domain (all 65,536 combos,
 *           the non-terminating ones skipped by an independent predicate) — a
 *           pure total function on its terminating inputs. The gate is
 *           exhaustive-crafted, and ALSO capture-backed (equivalence-3009.test.js
 *           test #0 replays every real attract dispatch).
 *           ★ CORRECTION: this header used to say "UNWIRED: 0x3009 is not in the
 *           dispatch registry (its callers are the untranslated 1977 subtree), so
 *           attract never dispatches it." Both halves were stale. 0x3009 IS a
 *           ROUTINES key, and all three call sites now have translated twins
 *           (0x1C9E in loc_1c8f, 0x1CBA in loc_1cab, 0x23F4 in advanceBarrelSpriteOrientation — plus a
 *           FOURTH the old note missed, 0x18DF in loc_18c6, whose `or 0x20` at
 *           0x18E2 consumes A). RE-DERIVED at write time against the pure translated
 *           oracle under `new Machine(ROM, { overrides })`, a counting override at 0x3009,
 *           `runFrames(N)` — 0 dispatches by frame 600, 23 by f700, 798 by f1500, 3850 by
 *           f12000, stable across repeats. PROVENANCE: that is a HARNESS REPLAY, our engine
 *           driving the ROM, so it is a [code] number and not a MAME observation. Quote it
 *           only with the method attached; counts measured by any other rig do not compare.
 *           It is dispatched routinely, which is why its wired entry point had to be fixed.
 * LIVE-OUT: memory-only (writes NO RAM) + register A. The CARRY flag and b/c/d are
 *           reproduced faithfully and checked by the test as free teeth, but NONE of
 *           them is a liveness claim — no translated successor is confirmed to read
 *           any of them. (See OUT: below for why the carry in particular is NOT live,
 *           despite an earlier version of this header saying it was.) The wired address takes
 *           A/B and lands all of it back in the register file, flags included; see
 *           the seam entry below.
 * NAMES:    none — pure arithmetic on register inputs; references no RAM address.
 *
 * @param {number} a  the input byte (Z80 A), 0..255.
 * @param {number} b  the 2-bit selector (Z80 B), 0..255.
 * @returns {{a:number, carry:boolean, b:number, c:number, d:number}} the register
 *   file at `ret`: a = result in A, carry = the carry flag, b/c/d as left by the
 *   routine. Does not return for a non-terminating (a,b) (it loops, like the ROM).
 */
export function nextAnimationStep(a, b) {
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

/**
 * The SEAM ENTRY for ROM 0x3009 — `ROUTINES[0x3009].entry`, the export the override
 * resolvers wire. The seam dispatches an override as `fn(m)`, one argument; the pure
 * function above keeps its `(a, b)` shape and its register-file return value for the
 * exhaustive gate.
 *
 * ★ THIS ONE DID NOT DEGRADE QUIETLY — IT HUNG. Wired directly, `nextAnimationStep(m)` gave `a` =
 * the Machine and `b` = undefined, so `(c & 0x03) === bEff` was never true and the scan
 * loop — which reproduces the ROM's own non-termination on purpose — spun forever with no
 * `m.step` budget to backstop it. With the register marshalling in place the inputs are
 * real bytes again and the routine terminates exactly when the ROM does.
 *
 * ABI, read off the frozen oracle (translated/loc_3009.js, ROM 0x3009-0x3049):
 *
 *     3009  57         ld d,a         ; D holds the ORIGINAL input for the exit test
 *     300a  ...        rrca / rlca    ; A picks the packed constant C
 *     302b  cb 50      bit 2,b        ; B is the selector, live-in
 *     3031  ...        the ror-2 scan of C's four 2-bit fields for a match to B
 *     303b  79 0f 0f e6 03  ld a,c / rrca x2 / and 0x03   ; A = the field AFTER the match
 *     3040  fe 03      cp 0x03        ; -> the CARRY, reproduced for fidelity, NOT live (see OUT:)
 *     3042  c0         ret nz         ; A = that field
 *     3043  cb 92 15   res 2,d / dec d
 *     3046  c0         ret nz         ; A = 3
 *     3047  3e 04 c9   ld a,0x04 / ret
 *
 *   IN:   A = the input byte, B = the 2-bit selector. (`ld d,a` at 0x3009 is internal —
 *         D is an output, not an input.)
 *   OUT:  A = the result. A is LIVE: loc_1C8F (0x1CA4) and loc_1CAB (0x1CC0) store it
 *         straight into 0x6202, and loc_18C6 (0x18E4) does `or 0x20` on it.
 *         ★ THE CARRY IS REPRODUCED BUT IS **NOT** LIVE — an earlier version of this header
 *         claimed advanceBarrelSpriteOrientation (ROM 0x23DE) consumed it, and that was WRONG. 0x23F7's `rra` does read the
 *         incoming carry, but into A BIT 7; what rotates onward into (ix+8) and (ix+7) is
 *         A's bit 0 and bit 1. The incoming carry ends up in A bit 6 and is then destroyed
 *         by `ld a,0x04` at 0x2401. Falsified by controlled measurement, not by re-reading:
 *         4000 randomized advanceBarrelSpriteOrientation runs forced onto the (ix+0x0f)==1 arm — the only arm that
 *         reaches here — each run twice with this routine's exit carry FLIPPED, gave ZERO
 *         differences in any register, flag or RAM byte; the control, flipping exit A
 *         instead, changed RAM on 500 of 500. The other three call sites overwrite F
 *         immediately (`and 0x03` at 0x1CA6 and 0x1CC2, `or 0x20` at 0x18E2).
 *         The carry is reproduced anyway because replaying the oracle's terminal `cp 0x03`
 *         is free and exact — fidelity for its own sake, not because a caller needs it.
 *   ALSO: B (decremented on the bit-0-set family), C (the matched rotation) and D.
 *   MEM:  nothing — a pure leaf.
 *
 * REGISTER-EXACT, flags included. The pure function already returns b/c/d, so nothing has
 * to be re-derived; F is rebuilt by REPLAYING the oracle's own terminal instructions
 * (`cp 0x03`, then `res 2,d` / `dec d`) rather than by assembling a flag byte by hand.
 */
export function nextAnimationStepFromRegisters(m) {
  const { regs } = m;
  const input = regs.a; // 0x3009 `ld d,a` — the saved input, read before A is rewritten
  const r = nextAnimationStep(input, regs.b);

  regs.b = r.b;
  regs.c = r.c;
  regs.d = input;

  // 0x303E `and 0x03` leaves A = the field after the match; on the two `next == 3` exits
  // that field IS 3, and A only becomes 3/4 further down.
  regs.a = r.carry ? r.a : 0x03;
  regs.cp(0x03); // 0x3040 — replays the oracle's own terminal compare (see OUT: the carry is NOT live)
  if (!r.carry) {
    // The `ret nz` at 0x3042 was not taken: the two-stage exit on the saved input.
    regs.d = regs.res(2, regs.d); // 0x3043 `res 2,d` — touches no flag
    regs.d = regs.dec8(regs.d); // 0x3045 `dec d` — sets the Z the `ret nz` at 0x3046 reads
    regs.a = r.a; // A stays 3, or becomes 0x04 at 0x3047 when D reached zero
  }
}
