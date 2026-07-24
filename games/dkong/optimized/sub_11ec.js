// SPDX-License-Identifier: GPL-3.0-only
/**
 * sub_11ec — hand-optimized rewrite of the translated routine at ROM 0x11EC,
 * proven equal to its oracle by the equivalence harness. A generic strided gather; it
 * names no work RAM (operands are the caller's HL/DE/BC).
 */

/**
 * sub_11ec -- interleaved strided copy: B passes, 2 bytes to E and E+2.  [ROM 0x11EC-0x11F9]
 *
 * A shadow-table filler reached from sub_11a6 (and thus the per-board setups). Each pass
 * reads two consecutive source bytes (HL, HL+1) and writes them to E and E+2 -- E+1 is
 * SKIPPED (two `inc e` between the stores) -- then advances E by the stride C and repeats B
 * times. HL is a LIVE-IN and is NOT restored (it walks forward across the whole call, unlike
 * sub_122a which brackets it with push/pop). `inc e` keeps D's page fixed; the carry out of
 * the final `add a,c` escapes through the `ret`.
 *
 * CYCLES -- COLLAPSED to one m.step per loop iteration (one basic block: the loop body has
 * no internal branch and no hardware write, so it folds to a single charge including the
 * djnz decision). Reached from the board setups, whose atomicity is not pinned to the
 * mask-cleared NMI, so this collapse is INTERRUPTIBLE and is licensed by the CONVERGENT
 * gate (see the accompanying equivalence test), not the strict whole-machine gate.
 */
export function sub_11ec(m) {
  const { regs, mem } = m;

  do {
    // loop body -- the djnz at 0x11F7 lands here. ld a,(hl)(7)+ld(de),a(7)+inc hl(6)+
    // inc e(4)+inc e(4)+ld a,(hl)(7)+ld(de),a(7)+inc hl(6)+ld a,e(4)+add a,c(4)+ld e,a(4)
    // = 60 t, plus the djnz's own charge (13 taken / 8 not taken).
    regs.a = mem.read8(regs.hl); // HL live-in, NOT restored
    mem.write8(regs.de, regs.a); // write at E
    regs.hl = (regs.hl + 1) & 0xffff; // `inc hl` -- full 16-bit

    // TWO increments: the next store lands at E+2, E+1 is skipped.
    regs.e = regs.inc8(regs.e);
    regs.e = regs.inc8(regs.e);

    regs.a = mem.read8(regs.hl);
    mem.write8(regs.de, regs.a); // write at E+2
    regs.hl = (regs.hl + 1) & 0xffff;

    regs.a = regs.e;
    regs.add(regs.c); // A = E + stride; carry escapes via the ret
    regs.e = regs.a; // 8-bit -- D untouched, destination wraps in its page

    regs.djnz();
    m.step(regs.b !== 0 ? 0x11ec : 0x11f9, 60 + (regs.b !== 0 ? 13 : 8));
  } while (regs.b !== 0);

  m.ret(); // 0x11F9
}
