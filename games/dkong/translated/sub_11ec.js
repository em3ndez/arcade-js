// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_11ec  (ROM 0x11EC–0x11F9) — 14 bytes, 13 instructions.
 *
 *   11ec  7e           ld   a,(hl)
 *   11ed  12           ld   (de),a
 *   11ee  23           inc  hl
 *   11ef  1c           inc  e
 *   11f0  1c           inc  e
 *   11f1  7e           ld   a,(hl)
 *   11f2  12           ld   (de),a
 *   11f3  23           inc  hl
 *   11f4  7b           ld   a,e
 *   11f5  81           add  a,c
 *   11f6  5f           ld   e,a
 *   11f7  10 f3        djnz 0x11ec
 *   11f9  c9           ret
 *
 * Three call sites: 0x10C0, 0x1157, 0x11AC.
 *
 * THIS IS sub_122a'S TWIN WITH THE SOURCE BEHAVIOUR INVERTED, and it is the
 * reason no reading of this family may be settled from a routine's SHAPE.
 * sub_122a brackets its inner loop in `push hl` / `pop hl`, so every outer pass
 * re-reads the SAME four source bytes. This routine has NO push/pop at all, so
 * HL advances CUMULATIVELY (+2 per pass) and it walks 2*B0 consecutive source
 * bytes. Near-identical bytes, opposite source semantics. They must NOT share a
 * parameterised helper -- one keyed on C alone is wrong for one of the two.
 *
 * The two stores per pass land at E and E+2; E+1 is NEVER written by this
 * routine. Effective stride between passes is C+2, against sub_122a's C+4,
 * because the `inc e` counts differ.
 *
 * THE DJNZ TARGETS THE ROUTINE ENTRY, so the entire body is loop, and there is
 * no setup instruction to hoist -- the sub_3fa6 trap, total here.
 *
 * HL IS A LIVE-IN: read by `ld a,(hl)` at instruction one, never loaded here.
 * At two of the three call sites the caller sets it a few instructions before.
 * At the third -- 0x11AC, inside sub_11a6 -- it is INHERITED from sub_11a6's
 * own caller and passed straight through. That is what makes sub_11a6's HL
 * parameter invisible: at the other two sites the value is in the instruction.
 *
 * Note the asymmetry in the pointer arithmetic: HL uses `inc hl` and DOES carry
 * into H, so the source may cross a page; E uses `inc e` and `add a,c` through
 * A, both 8-bit, and D is never written, so the destination CANNOT.
 *
 * The carry out of the final `add a,c` escapes through the `ret` -- `ld e,a`,
 * `djnz` and `ret` write no flags and `inc e` preserves C. Same shape as the
 * sub_3f24 finding, and invisible to a memory diff.
 *
 * B0 = 0 would give 256 passes (djnz decrements then tests). No call site is
 * known to do it; not defended against here because the ROM does not.
 */
export function sub_11ec(m) {
  const { regs, mem } = m;

  do {
    // Loop body, NOT setup -- the djnz at 0x11F7 lands here.
    regs.a = mem.read8(regs.hl); // HL is a live-in, and it is NOT restored
    m.step(0x11ed, 7);
    mem.write8(regs.de, regs.a); // writes at E
    m.step(0x11ee, 7);
    regs.hl = (regs.hl + 1) & 0xffff; // `inc hl` -- full 16-bit, carries into H
    m.step(0x11ef, 6);

    // TWO increments: the next store lands at E+2 and E+1 is skipped.
    regs.e = regs.inc8(regs.e);
    m.step(0x11f0, 4);
    regs.e = regs.inc8(regs.e);
    m.step(0x11f1, 4);

    regs.a = mem.read8(regs.hl);
    m.step(0x11f2, 7);
    mem.write8(regs.de, regs.a); // writes at E+2
    m.step(0x11f3, 7);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x11f4, 6);

    regs.a = regs.e;
    m.step(0x11f5, 4);
    regs.add(regs.c); // mutates A; carry escapes via the ret
    m.step(0x11f6, 4);
    regs.e = regs.a; // 8-bit -- D untouched, destination wraps in its page
    m.step(0x11f7, 4);

    regs.djnz();
    m.step(regs.b !== 0 ? 0x11ec : 0x11f9, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);

  m.ret(); // 11f9
}
