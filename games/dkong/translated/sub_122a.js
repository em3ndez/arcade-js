// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_122a  (ROM 0x122A–0x123B) — 18 bytes, 15 instructions.
 *
 *   122a  e5           push hl
 *   122b  c5           push bc
 *   122c  06 04        ld   b,0x04
 * loc_122e:
 *   122e  7e           ld   a,(hl)
 *   122f  12           ld   (de),a
 *   1230  23           inc  hl
 *   1231  1c           inc  e
 *   1232  10 fa        djnz 0x122e
 *   1234  c1           pop  bc
 *   1235  e1           pop  hl
 *   1236  7b           ld   a,e
 *   1237  81           add  a,c
 *   1238  5f           ld   e,a
 *   1239  10 ef        djnz 0x122a
 *   123b  c9           ret
 *
 * Eleven call sites: 0fec 100f 1017 1028 1037 1090 10cc 113a 1163 118f 11b8.
 *
 * WHAT IT IS: a struct-field initialiser, NOT a blitter. It replicates ONE
 * 4-byte source group down B0 destinations spaced C+4 apart.
 *
 * The `push hl`/`pop hl` bracket discards the inner loop's four `inc hl`, so
 * every outer pass re-reads the SAME four bytes. What that means is settled by
 * the CALLER, at 0x100F-0x1017:
 *
 *     1006  ld hl,0x101b     source
 *     100c  ld bc,0x081c     B=8, C=0x1c
 *     100f  call 0x122a
 *     1012  ld de,0x6807     <- reloads DE and B ONLY
 *     1015  ld b,0x02
 *     1017  call 0x122a      <- same HL, same C, still correct
 *
 * The second call reloads neither HL nor C. It is only correct if this routine
 * preserves both -- which is exactly what the two pushes buy. The ROM's own
 * usage is the proof; the register trace is not needed to reach it.
 *
 * THE OUTER `djnz` TARGETS THE ROUTINE ENTRY, so `push hl`, `push bc` and
 * `ld b,0x04` are LOOP BODY, not setup. Hoisting them out breaks the routine
 * catastrophically -- pass 2 would pop the caller's stack and unbalance the
 * `ret`. Same trap as sub_3fa6.
 *
 * TWIN HAZARD -- READ BEFORE TRANSLATING sub_11ec.
 * sub_11ec (ROM 0x11EC) is this routine's twin with the source behaviour
 * INVERTED: it has NO push/pop at all, so its HL advances cumulatively across
 * passes and it walks 2*B0 CONSECUTIVE source bytes. Its stride is C+2, not
 * C+4, because its `inc e` count differs; and it stores at E and E+2, never
 * writing E+1. The two differ in exactly one structural respect and it
 * reverses what the source pointer does. They must NOT share a parameterised
 * helper -- one keyed on C alone is wrong for one of the two.
 *
 * E arithmetic is 8-bit throughout: `inc e` (not `inc de`) and `add a,c` via
 * A. D is never modified, so the destination is confined to the page D selects
 * and WRAPS within it. A 16-bit `regs.de++` would silently turn a wrap into a
 * page crossing, and `inc e` also sets flags where `inc de` sets none.
 *
 * The carry out of the FINAL `add a,c` escapes through the `ret` to the
 * caller: `ld e,a`, `djnz` and `ret` write no flags, and `inc e` preserves C.
 * Same shape as the sub_3f24 finding -- invisible to a memory diff.
 *
 * B0 = 0 would give 256 passes (djnz decrements then tests). No call site is
 * known to do it; not defended against here because the ROM does not.
 *
 * ── THE FULL REGISTER CONTRACT, stated once because three routines depend on
 *    it from outside and none of them can see it ─────────────────────────────
 *
 * Derived from the 18 bytes, which are exhaustively:
 *   e5 c5 06 04 7e 12 23 1c 10 fa c1 e1 7b 81 5f 10 ef c9
 *
 *   HL   PRESERVED, actively -- `push hl` / `pop hl` bracket the inner loop,
 *        discarding its four `inc hl`. Proven from the CALLER at 0x1012, which
 *  reloads DE and B and neither HL nor C.
 *   C    PRESERVED, actively -- restored by `pop bc` at 0x1234.
 *   B    CLOBBERED -- 0 at the ret; both djnz run to zero.
 *   DE   D untouched; E advanced by B0*(C+4), 8-bit, wrapping in D's page.
 *   A    CLOBBERED, NOT AN INPUT. Its first touch is `ld a,(hl)` at 0x122E, a
 *        WRITE, and the inner loop always runs (B is loaded 0x04, never 0), so
 *        that write always precedes the only read of A -- `add a,c` at 0x1237,
 *        which is itself preceded by `ld a,e` at 0x1236 in the same pass. A is
 *        never read before being written. It exits equal to E.
 *   IX   PASSED THROUGH UNTOUCHED -- and this is a DIFFERENT guarantee from
 *        HL's. There is no DD or FD prefix byte anywhere in the routine, so IX
 *        and IY are neither read nor written. HL survives because the routine
 *        actively saves it; IX survives because the routine cannot see it.
 *        Both are "preserved for the caller", and only one of them would still
 *        hold if the body changed.
 *   F    the carry out of the FINAL `add a,c` escapes through the `ret`; see
 *        the note above.
 *
 * WHY THIS BLOCK EXISTS. C is loaded via `ld bc,nn`, survives this call, and
 * is consumed by a later `call 0x11d3` WITHOUT being reloaded -- because the
 * intervening load writes B only. That happens in three separate routines:
 *
 *     1186   C set 0x118C -> call here 0x118F -> 0x1199 loads B ONLY -> 0x119E
 *     1131   C set 0x1160 -> call here 0x1163 -> 0x1175 loads B ONLY -> 0x117A
 *     101f   C set 0x1034 -> call here 0x1037 -> 0x1044 loads B ONLY -> 0x1046
 *
 * The dependency is load-bearing in all three and invisible from any one of
 * them. It is satisfied only by the `pop bc` above.
 */
export function sub_122a(m) {
  const { regs, mem } = m;

  do {
    // Loop body, NOT setup -- the outer djnz at 0x1239 lands here.
    m.push16(regs.hl);
    m.step(0x122b, 11);
    m.push16(regs.bc);
    m.step(0x122c, 11);
    regs.b = 0x04; // inner count, always 4, never 0
    m.step(0x122e, 7);

    do {
      regs.a = mem.read8(regs.hl);
      m.step(0x122f, 7);
      mem.write8(regs.de, regs.a);
      m.step(0x1230, 7);
      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x1231, 6);
      regs.e = regs.inc8(regs.e); // `inc e`, NOT `inc de` -- D untouched
      m.step(0x1232, 4);
      regs.djnz();
      m.step(regs.b !== 0 ? 0x122e : 0x1234, regs.b !== 0 ? 13 : 8);
    } while (regs.b !== 0);

    regs.bc = m.pop16(); // restores the OUTER counter B *and* the stride C
    m.step(0x1235, 10);
    regs.hl = m.pop16(); // discards the inner loop's four `inc hl`
    m.step(0x1236, 10);

    regs.a = regs.e;
    m.step(0x1237, 4);
    regs.add(regs.c); // mutates A; carry escapes via the ret
    m.step(0x1238, 4);
    regs.e = regs.a;
    m.step(0x1239, 4);

    regs.djnz();
    m.step(regs.b !== 0 ? 0x122a : 0x123b, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);

  m.ret(); // 123b
}
