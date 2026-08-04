// SPDX-License-Identifier: GPL-3.0-only
/**
 * nextAnimationStep — bit-field lookup over a packed table of four 2-bit fields, keyed by an input
 * byte and a 2-bit selector.
 *
 * A leaf, and PURE over its two byte inputs (`a` and `b`): it reads no memory, writes no memory, and
 * calls nothing. Mechanically:
 *
 *   1. SELECT a packed byte C from three bits of `a`. Bit 0 of `a` picks a family — clear gives
 *      {0x90, 0x6c}, set gives {0xb4, 0x1e} — and bit 2 picks within the family. Each of 0x6c /
 *      0xb4 / 0x1e is a permutation of {0,1,2,3} across its four 2-bit fields; 0x90 is the odd one
 *      out, fields {0,0,1,2}. It has no 3, which is the only source of the hang below.
 *   2. On the bit-0-set family ONLY, if bit 2 of `b` is set, decrement `b`. Call the result `bEff`.
 *   3. SCAN C's four 2-bit fields for one equal to `bEff`, by rotating C right two bits at a time
 *      until its low two bits match. Rotate-by-2 has period 4, so this visits all four fields.
 *      FAITHFUL NON-TERMINATION: when no field CAN equal `bEff` — always so when `bEff` > 3, and
 *      when `bEff` == 3 with C == 0x90 — the hardware loops forever, and so does this. No guard is
 *      added: a cap would silently turn the hang into a wrong terminating result.
 *   4. EXIT on the field AFTER the match. Call it `next`.
 *      - next != 3  ->  return next, CARRY set (next is always < 3 here).
 *      - next == 3  ->  clear bit 2 of the ORIGINAL input and decrement it; return 3 while that is
 *                       still nonzero, else 0x04. CARRY clear on both.
 *
 * WHAT THE NAME CLAIMS, AND WHAT IT CANNOT. From this body the function is a packed-table lookup and
 * nothing more: nothing here says the result is an ANIMATION step, and what 0x6c / 0xb4 / 0x1e /
 * 0x90 encode individually is not established at all. The animation reading comes from how the
 * result is consumed, which is outside this file. The name stays a NOUN because the function is
 * PURE — it writes nothing, and whoever calls it performs the mutation.
 *
 * Reads and writes: nothing. Modelled as a pure function of its two inputs, so there is no stack or
 * program counter to model — the hardware's return is just this function returning.
 * LIVE-OUT: the result byte. The carry flag and the three residual register values are reproduced
 * faithfully and checked, but NONE of them is a liveness claim.
 *
 * @param {number} a  the input byte, 0..255.
 * @param {number} b  the 2-bit selector, 0..255.
 * @returns {{a:number, carry:boolean, b:number, c:number, d:number}} the register values at the
 *   return: a = the result, carry = the carry flag, b/c/d as the routine leaves them. Does not
 *   return at all for a non-terminating (a, b) — it loops, exactly as the hardware does.
 */
export function nextAnimationStep(a, b) {
  const ror2 = (v) => ((v >> 2) | (v << 6)) & 0xff; // 8-bit rotate right by two bits

  const d = a; // the original input, saved for the exit test
  let bEff = b;
  let c;

  if ((a & 0x01) === 0) {
    // bit 0 clear: C is 0x93 masked down to 0x90, unless bit 2 of `a` steers it to 0x6c.
    // (The bit that gates the mask is bit 2 of `a`, rotated into the carry.)
    c = (a & 0x04) ? 0x6c : 0x90;
  } else {
    // bit 0 set: C = 0xb4, or 0x1e when bit 2 of `a` is set.
    c = (a & 0x04) ? 0x1e : 0xb4;
    // Only this family adjusts the selector, and only when its bit 2 is set.
    if (b & 0x04) bEff = (b - 1) & 0xff;
  }

  // Rotate C right two bits per pass; stop when its low two bits equal bEff.
  // Loops forever if no 2-bit field of C can equal bEff — faithful to the hardware.
  for (;;) {
    c = ror2(c);
    if ((c & 0x03) === bEff) break;
  }

  // The field AFTER the match decides the exit.
  const next = ror2(c) & 0x03;
  if (next !== 3) {
    // The terminal compare against 3 sets the carry whenever next < 3, which it always is here.
    return { a: next, carry: true, b: bEff, c, d };
  }

  // next == 3: the compare was equal, so the carry is clear, and neither the bit-clear nor the
  // decrement below touches it.
  const d2 = ((d & ~0x04) - 1) & 0xff;
  if (d2 !== 0) return { a: 3, carry: false, b: bEff, c, d: d2 };
  return { a: 0x04, carry: false, b: bEff, c, d: d2 };
}

/**
 * The SEAM ENTRY — the export the override resolver wires. The seam calls an override with the
 * machine as its one argument; the pure function above keeps its `(a, b)` shape and its
 * register-file return value, so this wrapper marshals between the two.
 *
 * ★ THIS ONE DID NOT DEGRADE QUIETLY — IT HUNG. Wired directly, the machine object arrived where
 * the input byte was expected and the selector arrived undefined, so the scan loop's match test
 * was never true and the loop — which reproduces the hardware's own non-termination on purpose —
 * spun forever, with no instruction budget to backstop it. With the marshalling in place the
 * inputs are real bytes again and the routine terminates exactly when the hardware does.
 *
 * THE REGISTER CONTRACT. In: the input byte and the 2-bit selector. Out: the result in the
 * accumulator; alongside it the selector as this routine left it (decremented on the bit-0-set
 * family), the matched rotation, and the saved copy of the original input, which the two-stage
 * exit clears bit 2 of and decrements. Memory: nothing — a pure leaf.
 *
 * REGISTER-EXACT, FLAGS INCLUDED. The pure function already returns everything but the flags, and
 * those are rebuilt by REPLAYING the terminal compare and decrement rather than by assembling a
 * flag byte by hand — exact, and free. The carry is reproduced for fidelity, NOT because a
 * consumer for it was found.
 */
export function nextAnimationStepFromRegisters(m) {
  const { regs } = m;
  const input = regs.a; // the saved input, read before the accumulator is rewritten
  const r = nextAnimationStep(input, regs.b);

  regs.b = r.b;
  regs.c = r.c;
  regs.d = input;

  // The masked field after the match lands in the accumulator; on the two `next == 3` exits that
  // field IS 3, and the accumulator only becomes 3 or 4 further down.
  regs.a = r.carry ? r.a : 0x03;
  regs.cp(0x03); // replays the terminal compare — reproduced for fidelity, not for a consumer
  if (!r.carry) {
    // The first conditional return was not taken: the two-stage exit on the saved input.
    regs.d = regs.res(2, regs.d); // clear bit 2 of the saved input — touches no flag
    regs.d = regs.dec8(regs.d); // decrement it, setting the zero flag the second return reads
    regs.a = r.a; // the result stays 3, or becomes 0x04 when the saved input reached zero
  }
}
