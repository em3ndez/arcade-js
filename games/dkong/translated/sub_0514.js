// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_0514  (ROM 0x0514–0x051B) — descending 3-cell fill; HL,A,DE live-in.
 *
 *   0514  06 03        ld   b,0x03       ; PROLOGUE -- runs once
 *   0516  77           ld   (hl),a       ; loc_0516 -- the djnz target
 *   0517  19           add  hl,de
 *   0518  3d           dec  a
 *   0519  10 fb        djnz 0x0516
 *   051b  c9           ret
 *
 * Flags reaching the caller: S/Z/H/PV/N from the final `dec a`, C from the final
 * `add hl,de` (djnz and ret are flag-neutral).
 */
export function sub_0514(m) {
  const { regs, mem } = m;

  regs.b = 0x03;
  m.step(0x0516, 7); // ld b,0x03 -- PROLOGUE, outside the loop

  do {
    // loc_0516 -- the djnz target is HERE, not the routine entry.
    mem.write8(regs.hl, regs.a);
    m.step(0x0517, 7); // ld (hl),a
    regs.addHl(regs.de); // sets H/N/C, preserves S/Z/PV; the C is live at the ret
    m.step(0x0518, 11); // add hl,de
    regs.a = regs.dec8(regs.a);
    m.step(0x0519, 4); // dec a
    regs.djnz();
    m.step(regs.b !== 0 ? 0x0516 : 0x051b, regs.b !== 0 ? 13 : 8); // djnz 0x0516
  } while (regs.b !== 0);

  m.ret(); // ret (0x051B)
}
