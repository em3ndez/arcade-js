// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_20b5 — hand-optimized rewrite of the translated routine at ROM 0x20b5,
 * proven equal to its oracle by the equivalence harness.
 *
 * It touches only PER-OBJECT RECORD fields — (ix+0x10) and (ix+0x11), reached
 * through the object slot IX (0x6700 table, stride 0x20) that the caller supplies.
 * These are RECORD-RELATIVE offsets, not global addresses, so they are deliberately
 * kept HEX (the record-offset naming trap in docs/decompiler-pipeline): the same +0x10/+0x11 pair
 * means different bytes for every slot, so a global ram.js name would be wrong. No
 * ram.js import — like arm_1a4b, this routine references no absolute address.
 *
 * Its two continuations, 0x20e1 and 0x20c3, are invoked through `m.call` — the
 * routine registry (games/dkong/routines.js) — so each resolves to the oracle or to
 * its own optimized rewrite, never a copy here. Both are JP / fall-through targets
 * (NOT `call`s), so there is NO m.push16 at either boundary; the oracle likewise
 * transfers with a bare `m.call` and no pushed return address.
 */

/**
 * sub_20b5 -- set the horizontal-velocity SIGN for an object slot.  [ROM 0x20B5-0x20C2]
 *
 *   20b5  dd 7e 10     ld   a,(ix+0x10)   ; A = the slot's h-velocity sign byte
 *   20b8  a7           and  a             ; test it (Z iff 0); A unchanged
 *   20b9  c2 e1 20     jp   nz,0x20e1     ; already nonzero -> the +1 velocity variant
 *   20bc  dd 77 11     ld   (ix+0x11),a   ; (A==0 here) clear the +0x11 sub-byte
 *   20bf  dd 36 10 ff  ld   (ix+0x10),0xff; set the sign byte to 0xFF (the -1 variant)
 *   -- falls through --                    ; into sub_20c3 (physically the next insn)
 *
 * WHAT IT DOES. Reached from sub_20a2 (state-1 of the object sub-state machine
 * sub_2083), itself dispatched from the 0x197a in-game update cascade via
 * sub_1f72's 10-slot object loop (0x6700 table) -> loc_1f93 -> branch_2053 ->
 * sub_2083 -> sub_20a2. sub_20a2 tail-jumps here to (re)establish the object's
 * horizontal step direction:
 *   - (ix+0x10) == 0 (Z): the object had no sign yet -- clear the +0x11 fraction
 *     byte and set (ix+0x10) = 0xFF (the -1 / move-LEFT variant), then fall into
 *     sub_20c3 (the landing/fixed-point setup that stores the derived step into
 *     +0x12/0x13 and clears +0x14/0x04/0x06).
 *   - (ix+0x10) != 0 (NZ): a sign is already set -- hand off to sub_20e1, which
 *     forces (ix+0x10)=0x01 / (ix+0x11)=0x00 (the +1 / move-RIGHT variant) and
 *     then jp's into the SAME sub_20c3 tail.
 * So every arm ends inside sub_20c3; this routine only decides the SIGN byte.
 *
 * INPUTS  : RAM (ix+0x10) (the sign byte read + tested). Register IX (the live
 *           object slot base, set by the sub_1f72 loop). Nothing else is read.
 * OUTPUTS :
 *   - NZ arm: no RAM write here; A = (ix+0x10) (the nonzero read value, `and a`
 *     leaves A intact), F = flags(A). Transfers to 0x20e1.
 *   - Z  arm: (ix+0x11) := 0, (ix+0x10) := 0xFF; A = 0, F = flags(0). Transfers
 *     to 0x20c3.
 *   Both arms leave B/C/D/E/HL/IY/SP unchanged; PC + cumulative cycles as below.
 *
 * FLAGS -- `and a` is KEPT (regs.and) rather than dropped. It is the LAST flag
 * writer in this routine before control leaves via m.call, so the F handed to the
 * continuation must equal the oracle's; the unit gate compares the whole register
 * file including F (and F3/F5). Keeping the one op makes F byte-exact for free
 * instead of hand-deriving sz/half-carry/parity. The branch itself reads A, not F
 * -- `regs.a !== 0` is exactly `jp nz` after `and a` (Z is set iff A==0, and `and a`
 * does not change A), the idiomatic form docs/decompiler-pipeline asks for.
 *
 * CYCLES -- COLLAPSED to ONE m.step per branch arm, each charging that arm's exact
 * oracle total at the arm's transfer PC:
 *   - NZ arm  = ld a (19) + and a (4) + jp nz taken (10)                 = 33 t -> 0x20e1
 *   - Z  arm  = ld a (19) + and a (4) + jp nz not-taken (10)
 *               + ld (ix+0x11),a (19) + ld (ix+0x10),0xff (19)           = 71 t -> 0x20c3
 * The collapse is LICENSED because sub_20b5 is ATOMIC: its ONLY call path runs
 * inside the vblank NMI's 0x197a cascade (measured: io.nmiMask == 0 at 100% of
 * dispatches over a 1200/2000-frame attract run; no NMI pushed-PC lands in the
 * 0x1900-0x2FFF cascade band, docs/decompiler-pipeline). No NMI can fire between the folded charges,
 * so only each arm's TOTAL is observable (via the main-loop spin count / PRNG),
 * and the total is preserved exactly. Neither store is a 0x7Dxx hardware latch --
 * (ix+0x10)/(ix+0x11) are work RAM in the 0x6700 object table -- so no bus-cycle
 * boundary needs pinning and no write-trace test is required.
 *
 * GATE -- STRICT whole-machine + unit (docs/decompiler-pipeline). sub_20b5 dispatches NON-vacuously
 * in attract (measured: 4x over 1200 frames, 15x over 2000 -- object slots at
 * 0x6700 animate during the attract board-1 demo) and BOTH arms occur naturally
 * (Z: (ix+0x10)==0, and NZ: (ix+0x10)==0xff). Because it is atomic, a total-
 * preserving collapse stays byte-exact, so the strict whole-machine gate (not the
 * relaxed convergent gate) is the right one. Each arm's cycle total is ALSO pinned
 * DIRECTLY against the oracle from a captured natural entry (equivalence-20b5),
 * with a dropped-charge twin as the teeth, so the collapse is proven arm-by-arm and
 * not only through the PRNG channel.
 */
export function sub_20b5(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;

  // ld a,(ix+0x10) ; and a -- read the sign byte and set flags. `and a` leaves A
  // intact; branch on A (Z is set iff A==0, so `A !== 0` == the oracle's `jp nz`).
  regs.a = mem.read8(R(0x10));
  regs.and(regs.a);

  if (regs.a !== 0) {
    // NZ: a sign is already present -> jp 0x20e1 (the +1 velocity variant). No RAM
    // write in this routine. Whole-arm total 19+4+10 = 33 t, transfer PC 0x20e1.
    m.step(0x20e1, 33);
    return m.call(0x20e1);
  }

  // Z (A == 0): clear the +0x11 sub-byte, force the sign byte to 0xFF (-1 variant),
  // then FALL THROUGH into sub_20c3 (0x20c3 is physically the next instruction).
  mem.write8(R(0x11), regs.a); // A == 0
  mem.write8(R(0x10), 0xff);
  // Whole-arm total 19+4+10+19+19 = 71 t, transfer PC 0x20c3.
  m.step(0x20c3, 71);
  return m.call(0x20c3);
}
