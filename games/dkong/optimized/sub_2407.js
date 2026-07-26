// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_2407 — hand-optimized rewrite of the translated routine at ROM 0x2407,
 * proven equal to its oracle by the equivalence harness.
 *
 * A pure arithmetic LEAF: it calls nothing and writes NO memory, so it imports no
 * RAM names. Its only operands are the three IX-relative record fields (ix+0x12,
 * +0x13, +0x14); those offsets are kept HEX (the record-offset trap in docs/06 —
 * an ix+d displacement is a structure offset, not an absolute address, and naming
 * it would misread it). See the naming note in the test / report.
 */

/**
 * sub_2407 -- FIXED-POINT SUBTRACT: spread a packed byte, then subtract BC.
 * [ROM 0x2407-0x241E, 24 bytes; a LEAF reached only via `m.call(0x2407)` from
 * loc_1bd8 (0x1BDF), sub_20c3 (0x20C6) and loc_2146 (0x2149) -- the object-physics
 * routines, dispatched from INSIDE loc_197a's in-game update cascade, entered
 * mask-cleared within the vblank NMI.]
 *
 *   2407  dd 7e 14  ld   a,(ix+0x14)   ; A = packed 0xHL  (H = hi nibble, L = lo nibble)
 *   240a  07 07 07 07  rlca x4         ; nibble-swap A -> 0xLH   (carry dead, masked next)
 *   240e  4f        ld   c,a           ; stash the swapped byte
 *   240f  e6 0f     and  0x0f          ; A = 0x0H  (original HIGH nibble)
 *   2411  67        ld   h,a           ; H = 0x0H
 *   2412  79        ld   a,c           ; A = 0xLH again
 *   2413  e6 f0     and  0xf0          ; A = 0xL0  (LOW nibble << 4); AND clears carry
 *   2415  6f        ld   l,a           ; L = 0xL0
 *   2416  dd 4e 13  ld   c,(ix+0x13)   ; C = BC low
 *   2419  dd 46 12  ld   b,(ix+0x12)   ; B = BC high
 *   241c  ed 42     sbc  hl,bc         ; HL = HL - BC - carry(=0)
 *   241e  c9        ret
 *
 * WHAT IT DOES. The packed byte at (ix+0x14) holds two BCD-ish nibbles 0xHL. The
 * four `rlca` + two `and` are a nibble spread: they build HL = (H << 8) | (L << 4)
 * -- H into the high byte's low nibble, L into the low byte's HIGH nibble (i.e. a
 * fixed-point value with a 4-bit fraction). Then a 16-bit BC read from (ix+0x12:0x13)
 * is subtracted. HL is returned to the caller (loc_1bd8 stores H/L back into the
 * record; sub_20c3 shifts H; loc_2146 uses HL as a coordinate). Writes nothing.
 *
 * The whole thing collapses to a handful of nibble extractions:
 *   H := packed >> 4           (0x0H)   -- the oracle's `and 0x0f` after the swap
 *   A := (packed << 4) & 0xf0  (0xL0)   -- the oracle's `and 0xf0` after the swap
 *   L := A
 * The register-churny swap (rlca x4, `ld c,a`, `ld a,c`) exists only to reach those
 * two nibbles with the Z80's byte ops; the result is exactly the two masks above.
 *
 * INPUTS  : IX (live-in); RAM (ix+0x12), (ix+0x13), (ix+0x14). CARRY IN is irrelevant
 *           to the caller's contract -- the oracle's `and 0xf0` forces it to 0 before
 *           the sbc, so the subtract is a plain HL-BC with no borrow-in (reproduced
 *           below by `and a` clearing carry).
 * OUTPUTS : HL = spread(0xHL) - BC. Register file on return (the unit gate compares
 *           ALL of it, incl. F):
 *             A = 0xL0  (the low nibble << 4 -- the last `and 0xf0` result; NOT dead,
 *                        so it is reproduced),
 *             B = (ix+0x12),  C = (ix+0x13),
 *             H,L = the sbc result,  D/E/IX/IY unchanged,
 *             F = the `sbc hl,bc` flags (S,Z,H,PV,N=1,C=borrow,F3,F5).
 *
 * FLAGS -- the ONLY flag that is load-bearing inside the routine is the CARRY going
 * into `sbc hl,bc`, which must be 0. Every earlier flag write (the four `rlca`, the
 * two `and`) is DEAD: nothing reads it before `sbc hl,bc` overwrites the ENTIRE F
 * (sbcHl assigns this.f outright -- no bit survives from before it). So the swap's
 * flag churn is dropped; the exit F is purely the sbc's, matching the oracle. `and a`
 * (AND A,A) reproduces the oracle's carry-clear WITHOUT disturbing A -- the same
 * `and a; sbc hl,bc` idiom sub_1486 uses for its two sbc compares.
 *
 * CYCLES -- COLLAPSED. sub_2407 is ONE basic block (straight-line, no branch, no call,
 * no memory write, no hardware-latch write), so the entire body folds into a SINGLE
 * m.step at the block-exit PC 0x241E: 19 + 4*4 + 4 + 7 + 4 + 4 + 7 + 19 + 19 + 15 =
 * 118 t (the exact oracle sum), then the `ret` stays verbatim (10 t). Total 128 t,
 * byte-for-byte the oracle's.
 *
 * GATE -- STRICT (whole-machine, byte-exact) + unit. sub_2407 is ATOMIC on every call
 * path, MEASURED: at 100% of its dispatches (12/12 over a 1200-frame attract run,
 * 4/4 over 1600 driven-gameplay frames) io.nmiMask == 0 -- it runs mask-cleared inside
 * the vblank NMI (the loc_197a cascade), so a second NMI cannot land inside it, and 0
 * NMI pushed-PC ever fell in [0x2407,0x241E]. Because it is atomic, the total-preserving
 * collapse is byte-identical to the oracle at the surviving m.step boundary, so it
 * passes the STRICT gate (not merely the convergent one) -- confirmed non-vacuous
 * (the override fires) by the whole-machine test. FULL-BRANCH coverage is trivial:
 * NO data-dependent branch, so the single straight-line path is the only path; the
 * unit test additionally proves the arithmetic across several crafted operand sets
 * (incl. a borrow that sets carry) so the transform is general, not entry-specific.
 */
export function sub_2407(m) {
  const { regs, mem } = m;
  const ix = regs.ix;

  // (ix+0x14) = packed 0xHL. Extract the two nibbles the rlca/and dance reaches:
  const packed = mem.read8((ix + 0x14) & 0xffff);
  regs.h = packed >> 4; //           H = 0x0H  (original HIGH nibble)  [oracle: and 0x0f]
  regs.a = (packed << 4) & 0xf0; //  A = 0xL0  (LOW nibble << 4)       [oracle: and 0xf0]
  regs.l = regs.a; //                L = 0xL0

  // BC = (ix+0x12):(ix+0x13), oracle order (C then B).
  regs.c = mem.read8((ix + 0x13) & 0xffff);
  regs.b = mem.read8((ix + 0x12) & 0xffff);

  // sbc hl,bc with carry-in 0. `and a` clears carry (leaving A = 0xL0 untouched),
  // reproducing the oracle's `and 0xf0` carry-clear; sbcHl then assigns HL + the exit F.
  regs.and(regs.a);
  regs.sbcHl(regs.bc);

  // Whole body folded: 19+4+4+4+4+4+7+4+4+7+4+19+19+15 = 118 t, exit PC 0x241E.
  m.step(0x241e, 118);
  m.ret(10);
}
