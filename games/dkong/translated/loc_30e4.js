// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_30e4  (ROM 0x30E4–0x30EC) — 9 bytes, 6 instructions.
 *
 *   30e4  7d           ld   a,l
 *   30e5  36 00        ld   (hl),0x00     ; loc_30e5 -- the djnz target
 *   30e7  c6 04        add  a,0x04
 *   30e9  6f           ld   l,a
 *   30ea  10 f9        djnz 0x30e5
 *   30ec  c9           ret
 *
 * Translated for completeness; not yet wired into the live dispatcher. Reached
 * only through handler_1977, which is not translated.
 *
 * Zeros up to B bytes at stride 4, walking L ONLY. `ld a,l` is a PROLOGUE
 * (the djnz targets 0x30E5, not the entry), and it is memory/register/flag-
 * identical whether inside or outside the loop -- it differs by 20 T only,
 * because `ld l,a` already leaves A == L at the top of each pass. Third member
 * of the state-diff-invisible / cycle-visible class (with loc_1131's ld bc,nn
 * and sub_11fa's inc e).
 *
 * FIVE ENTRY PATHS, and two are not `call`s: a TAIL JUMP at 0x30D8 (jp 0x30e4,
 * pushes nothing, so this ret returns to sub_30bd's caller) and a FALLTHROUGH
 * from entry_30db. Those callers are also >= 0x3000 (mine) and land later in
 * the drain; drafting the tail jump as a call would push 0x30DB = entry_30db,
 * running an extra six-store pass. Reported by the drafter, not absorbed.
 *
 * H IS PRESERVED ONLY BECAUSE NOTHING HERE WRITES IT, and 0x30C5/0x30CC depend
 * on that (they reload L alone). The NEVER-WRITTEN kind of preservation -- an
 * edit touching H breaks two call sites silently.
 *
 * `ld l,a` writes L ONLY -- deliberately not `regs.hl += 4`, which would carry
 * into H on an L wrap the Z80 does not do here. No entry path reaches the wrap
 * (highest exit L = 0xE4), so the 16-bit form is indistinguishable on every
 * existing path -- latent, and pinned with a SYNTHETIC boundary test.
 *
 * S8: every store is the CONSTANT 0x00 to a distinct address, so reordering or
 * miscounting the loop is invisible to final memory and to a state diff --
 * only the write trace records it. Stronger than sub_11fa, where the seven
 * stored values at least pinned each address.
 *
 * B0 = 0 would run 256 passes (djnz decrements then tests). No entry path does
 * it; not defended against because the ROM does not.
 */
export function loc_30e4(m) {
  const { regs, mem } = m;

  regs.a = regs.l;
  m.step(0x30e5, 4); // ld a,l -- PROLOGUE, the djnz target is 0x30E5 not here

  do {
    mem.write8(regs.hl, 0x00); // constant 0x00 -- order invisible to state diff
    m.step(0x30e7, 10); // ld (hl),0x00
    regs.add(0x04);
    m.step(0x30e9, 7); // add a,0x04
    regs.l = regs.a; // L ONLY -- no carry into H, unlike regs.hl += 4
    m.step(0x30ea, 4); // ld l,a
    regs.djnz();
    m.step(regs.b !== 0 ? 0x30e5 : 0x30ec, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);

  m.ret(); // 30ec
}
