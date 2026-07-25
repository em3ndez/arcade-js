// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_197a  (ROM 0x197A–0x19D0) — the shared per-frame update cascade (task dw 0x197a @0x071A, and.
 * handler_1977's tail). ~25 calls; the ONE hidden exit is sub_1e57 @0x19B9 (pop-hl
 * unwind -> aborts to our caller), boolean-guarded. All other calls return normally
 * (an rst caller-skip inside a callee aborts THAT callee's caller = us, so from our
 * frame it returned). The 0x198F-0x19D1 run is `defb`-hidden in dk.asm but is LIVE
 * code. Callee names mapped to their integrated forms.
 */
export function loc_197a(m) {
  const { regs, mem } = m;

  // ---- head cascade (0x197A-0x198E) ----
  m.push16(0x197d); m.step(0x1dbd, 17); m.call(0x1dbd);
  m.push16(0x1980); m.step(0x1e8c, 17);
  if (!m.call(0x1e8c)) return; // 0x1E96 non-zero path fell into entry_1e94 skip-tail & RETed
  m.push16(0x1983); m.step(0x1ac3, 17); m.call(0x1ac3);
  m.push16(0x1986); m.step(0x1f72, 17); m.call(0x1f72);
  m.push16(0x1989); m.step(0x2c8f, 17); m.call(0x2c8f);
  m.push16(0x198c); m.step(0x2c03, 17); m.call(0x2c03);
  m.push16(0x198f); m.step(0x30ed, 17); m.call(0x30ed);

  // ---- the cascade the listing hides as `defb` -- LIVE code ----
  m.push16(0x1992); m.step(0x2e04, 17); m.call(0x2e04);
  m.push16(0x1995); m.step(0x24ea, 17); m.call(0x24ea);
  m.push16(0x1998); m.step(0x2ddb, 17); m.call(0x2ddb);
  m.push16(0x199b); m.step(0x2ed4, 17); m.call(0x2ed4);
  m.push16(0x199e); m.step(0x2207, 17); m.call(0x2207);
  m.push16(0x19a1); m.step(0x1a33, 17); m.call(0x1a33);
  m.push16(0x19a4); m.step(0x2a85, 17); m.call(0x2a85);
  m.push16(0x19a7); m.step(0x1f46, 17); m.call(0x1f46);
  m.push16(0x19aa); m.step(0x26fa, 17); m.call(0x26fa);
  m.push16(0x19ad); m.step(0x25f2, 17); m.call(0x25f2);
  m.push16(0x19b0); m.step(0x19da, 17); m.call(0x19da);
  m.push16(0x19b3); m.step(0x03fb, 17); m.call(0x03fb);
  m.push16(0x19b6); m.step(0x2808, 17); m.call(0x2808);
  m.push16(0x19b9); m.step(0x281d, 17); m.call(0x281d);

  // @0x19B9 HIDDEN EXIT -- sub_1e57's pop-hl unwind aborts us
  m.push16(0x19bc);
  m.step(0x1e57, 17); // call 0x1e57
  if (!m.call(0x1e57)) return; // NOT a plain call -- returned to OUR caller

  m.push16(0x19bf); m.step(0x1a07, 17);
  if (!m.call(0x1a07)) return; // idx3 caller-skip jumped to the tail & RETed
  m.push16(0x19c2); m.step(0x2fcb, 17); m.call(0x2fcb);

  // ---- 0x19C2: three nops -- a REMOVED call, keep the 12 T ----
  m.step(0x19c3, 4); // nop
  m.step(0x19c4, 4); // nop
  m.step(0x19c5, 4); // nop

  regs.a = mem.read8(0x6200); // coin/mode byte
  m.step(0x19c8, 13); // ld a,(0x6200)
  regs.and(regs.a);
  m.step(0x19c9, 4); // and a
  if (regs.fNZ) {
    m.ret(11); // ret nz -- (0x6200) != 0, skip the tail
    return;
  }
  m.step(0x19ca, 5); // ret nz NOT taken -- (0x6200) == 0

  m.push16(0x19cd); m.step(0x011c, 17); m.call(0x011c);
  regs.hl = 0x6082;
  m.step(0x19d0, 10); // ld hl,0x6082
  mem.write8(regs.hl, 0x03);
  m.step(0x19d2, 10); // ld (hl),0x03
  return m.call(0x19d2);
}
