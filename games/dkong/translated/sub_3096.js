// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_3096  (ROM 0x3096–0x309E) — 9 bytes, 7 instructions.
 *
 *   3096  06 02        ld   b,0x02
 *   3098  79           ld   a,c           ; loc_3098 -- the djnz target
 *   3099  ae           xor  (hl)
 *   309a  77           ld   (hl),a
 *   309b  19           add  hl,de
 *   309c  10 fa        djnz 0x3098
 *   309e  c9           ret
 *
 * Translated for completeness; not yet wired into the live dispatcher. Reached
 * only via sub_306f, itself in the untranslated 1977 subtree.
 *
 * XORs C into two bytes at HL, stride DE. B is fixed at 2. THREE LIVE-INS: HL
 * (dest), C (mask), DE (stride). DE is never set here and never set by the
 * caller sub_306f -- it is 0x0004, left as a side effect of loc_0038's
 * `ld de,0x0004` up the call chain. Both call sites are in
 * sub_306f; no other caller.
 *
 * `xor (hl)` is a READ-modify-write: it XORs the EXISTING byte with C, so the
 * read of (HL) is load-bearing -- writing C directly would be a different
 * result. The final `add hl,de` carry escapes to the caller (dead on both
 * current paths). `add hl,de` writes H/N/C; regs.addHl is required, not a bare
 * 16-bit add.
 */
export function sub_3096(m) {
  const { regs, mem } = m;

  regs.b = 0x02;
  m.step(0x3098, 7); // ld b,0x02

  do {
    regs.a = regs.c; // C is the mask, reloaded each pass and never modified
    m.step(0x3099, 4); // ld a,c
    regs.xor(mem.read8(regs.hl)); // RMW -- XOR the EXISTING byte, not just C
    m.step(0x309a, 7); // xor (hl)
    mem.write8(regs.hl, regs.a);
    m.step(0x309b, 7); // ld (hl),a
    regs.addHl(regs.de); // DE = 0x0004 live-in; carry escapes to the caller
    m.step(0x309c, 11); // add hl,de
    regs.djnz();
    m.step(regs.b !== 0 ? 0x3098 : 0x309e, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);

  m.ret(); // 309e
}
