// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0583  (ROM 0x0583–0x0592) — the BCD expansion loop
 *
 *   0583  7e           ld   a,(hl)           ; loop
 *   0584  0f           rrca
 *   0585  0f           rrca
 *   0586  0f           rrca
 *   0587  0f           rrca
 *   0588  cd 93 05     call 0x0593
 *   058b  7e           ld   a,(hl)
 *   058c  cd 93 05     call 0x0593
 *   058f  2b           dec  hl
 *   0590  10 f1        djnz 0x0583
 *   0592  c9           ret
 *
 * A THIRD ENTRY POINT into this block. draw_0578 reaches 0x0583 by falling
 * into it after setting IX/DE/BC, but sub_0616 TAIL JUMPS straight here with
 * its own HL, DE, IX and B -- so 0x0583 is entered from two routines that
 * share no prologue. Extracted rather than adding another entry flag: the
 * flag pattern already carries `enteredAt057C`, and a second one would encode
 * the control-flow graph in booleans instead of in functions.
 *
 * The four `rrca`s are a nibble SWAP, not a shift -- rotating A right four
 * times puts the high nibble low, and sub_0593 masks with 0x0F. That is why
 * one code path emits the high digit then the low one with no shift variant.
 *
 * HL walks BACKWARDS while IX walks by DE, which is what reverses source
 * byte order into display order.
 *
 * Its `ret` returns to whoever called the ROUTINE, not to draw_0578 -- for
 * sub_0616 that means the tail jump's caller, which is the whole point of a
 * tail jump.
 */
export function loc_0583(m) {
  const { regs, mem } = m;

  do {
    regs.a = mem.read8(regs.hl);
    m.step(0x0584, 7);
    for (const nxt of [0x0585, 0x0586, 0x0587, 0x0588]) {
      regs.rrca();
      m.step(nxt, 4);
    }
    m.push16(0x058b);
    m.step(0x0593, 17);
    m.call(0x0593); // high nibble

    regs.a = mem.read8(regs.hl);
    m.step(0x058c, 7);
    m.push16(0x058f);
    m.step(0x0593, 17);
    m.call(0x0593); // low nibble

    regs.hl = (regs.hl - 1) & 0xffff;
    m.step(0x0590, 6);
    regs.djnz();
    m.step(regs.b !== 0 ? 0x0583 : 0x0592, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);

  m.ret();
}
