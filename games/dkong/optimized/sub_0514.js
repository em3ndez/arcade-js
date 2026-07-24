// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_0514 — hand-optimized rewrite of the translated routine at ROM 0x0514,
 * proven equal to its oracle by the equivalence harness.
 *
 * One routine per file. sub_0514 is a LEAF — it calls nothing — so there is no
 * `m.call` here and nothing to import from ram.js: the routine touches no
 * absolute address, only the live-in registers HL/A/DE. (It writes wherever HL
 * points; its callers hand it a colour-RAM column address.)
 */

/**
 * sub_0514 -- colour-column fill primitive: store A into 3 colour-RAM cells,
 * descending, stride DE.  [ROM 0x0514-0x051B]
 *
 *   0514  06 03     ld  b,0x03     ; PROLOGUE (runs once): loop count = 3
 *   0516  77        ld  (hl),a     ; loc_0516 -- the djnz target
 *   0517  19        add hl,de      ; step to the next cell (DE = 0x20 stride)
 *   0518  3d        dec a          ; next colour value (descending)
 *   0519  10 fb     djnz 0x0516    ; loop 3x
 *   051b  c9        ret
 *
 * WHAT IT DOES. A tiny fixed-count fill used by the ATTRACT / intro colour-cycle
 * driver (entry_03fb) and by sub_1708 to paint one three-cell "column" of the
 * character/colour RAM. It writes the byte in A to (HL), advances HL by the
 * stride in DE, decrements A, and repeats exactly THREE times. B is hard-loaded
 * to 3 at entry, so the loop count is INVARIANT — there is no data-dependent
 * branch and no "loop 0/1/many" case: it always runs 3 passes. On the live
 * board-1 cascade its only caller is loc_04a3 (HL=0x75C4, A=0x10, DE=0x20), so
 * the three cells written are 0x75C4/0x75E4/0x7604 with 0x10/0x0F/0x0E.
 *
 * INPUTS  (all live-in): HL = first cell address, A = first colour byte,
 *         DE = stride (0x0020 in every observed call).
 * OUTPUTS: three bytes of colour RAM at HL, HL+DE, HL+2*DE set to A, A-1, A-2;
 *         HL advanced by 3*DE; A decremented by 3; B = 0; DE unchanged.
 *
 * TARGET RAM. The writes land in the character/colour RAM window (0x74xx-0x77xx),
 * ordinary video/work RAM whose VALUE is what matters — NOT a 0x7Dxx hardware
 * latch. So there is no bus-cycle / write-order concern and no `--writes` trace
 * to preserve: the RAM+register unit gate sees everything this routine does.
 *
 * FLAGS reaching the caller: S/Z/H/PV/N from the final `dec a`, C from the final
 * `add hl,de` (djnz and ret are flag-neutral). No live caller actually CONSUMES
 * them — loc_04a3, loc_04be and loc_04f1 each overwrite F with an `ld`/`bit`
 * before their next conditional — but the unit gate compares the whole register
 * file including F, so they are reproduced EXACTLY by using the same `addHl` /
 * `dec8` register helpers the oracle does (an idiomatic re-derivation of the
 * Z80 half-carry / parity would be a needless risk here).
 *
 * CYCLES -- COLLAPSED to ONE m.step: B is hard-loaded to 3 (not data-dependent),
 * so the trip count is INVARIANT and the loop is unrolled rather than modelled as
 * a data-dependent djnz. ld b,0x03[7] + pass1 (ld (hl),a[7]+add hl,de[11]+dec a[4]
 * +djnz TAKEN[13] = 35) + pass2 (35, djnz TAKEN again) + pass3 (ld (hl),a[7]+
 * add hl,de[11]+dec a[4]+djnz NOT taken[8] = 30) = 107 t, then `m.ret()` (10 t,
 * the default unconditional RET charge) -- 117 t total, exactly the oracle's
 * (cross-checked against this file's own prior per-instruction charges, all
 * previously proven equal). Total-preservation keeps the caller's cycle clock
 * exact; only the mid-routine PC snapshot an NMI would observe is coarsened,
 * same as any collapse. djnz() itself sets no flags (it is NOT dec8(b)), and it
 * is called 3 times here purely to keep B's wraparound identical to the oracle's
 * (B ends at 0) -- its return value is unused since the trip count is fixed.
 *
 * Every `m.call(0x0514)` site is reached from the INTERRUPTIBLE per-frame cascade
 * (loc_04a3/loc_04be/loc_04f1 <- loc_0486 <- entry_03fb <- loc_197a, and
 * sub_1708/0x17cd), all with the NMI mask ENABLED, so the vblank NMI can land
 * inside it; see the equivalence test for the (convergent, unconditionally) gate
 * this routine runs under.
 */
export function sub_0514(m) {
  const { regs, mem } = m;

  // ld b,0x03 -- loop count (PROLOGUE, runs once, outside the loop body).
  regs.b = 0x03;

  // loc_0516 (the djnz target), unrolled 3x: fill 3 cells descending. `add hl,de`
  // leaves C and `dec a` leaves S/Z/H/PV/N live at the ret; djnz decrements B
  // without touching F.
  for (let pass = 0; pass < 3; pass++) {
    mem.write8(regs.hl, regs.a); // ld (hl),a
    regs.addHl(regs.de); // add hl,de
    regs.a = regs.dec8(regs.a); // dec a
    regs.djnz(); // djnz 0x0516 (flag-neutral); trip count is fixed, so the return is unused
  }
  m.step(0x051b, 107); // ld b,3[7] + pass1[35] + pass2[35] + pass3[30] (djnz NOT taken)

  m.ret(); // 051b ret (10 t default -- total 117 t)
}
