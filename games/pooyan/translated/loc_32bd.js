// SPDX-License-Identifier: GPL-3.0-only
//
// loc_32bd  (ROM 0x32bd-0x3306) -- shared epilogue for the loc_308b hunter-formation dispatch (pushed
// as the handler return). Keyed on (0x8f24): state 1 tears down the wave (clear 0x8d21/0x8d22, run
// loc_0fad, advance state, ROM self-check at 0x0779 -> guard 0x1f40); state 2 walks the boss actor
// (0x8a84) down, calling loc_23d7 until it passes 0xdb then loc_0f30 + a completion flag (0x8d32);
// state >=3 returns. loc_0fad/0f30/23d7 pattern A; guard 0x1f40 delegated.
export function loc_32bd(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8f24); m.step(0x32c0, 13); // 32bd  ld a,(0x8f24)
  regs.and(regs.a); m.step(0x32c1, 4);
  if (regs.fZ) { m.ret(11); return; }
  m.step(0x32c2, 5);
  regs.cp(0x02); m.step(0x32c4, 7);
  if (regs.fZ) {
    m.step(0x32e8, 12);
    regs.hl = 0x8a84; m.step(0x32eb, 10);
    regs.incMem8(mem, regs.hl); m.step(0x32ec, 11); // 32eb  inc (hl)
    regs.incMem8(mem, regs.hl); m.step(0x32ed, 11); // 32ec  inc (hl)
    regs.a = mem.read8(regs.hl); m.step(0x32ee, 7); // 32ed  ld a,(hl)
    regs.cp(0xdb); m.step(0x32f0, 7);
    if (regs.fNC) {
      m.step(0x32f6, 12);
    } else {
      m.step(0x32f2, 7);
      m.push16(0x32f5); m.step(0x23d7, 17); m.call(0x23d7);
      m.ret(); return;
    }
    m.push16(0x32f9); m.step(0x0f30, 17); m.call(0x0f30);
    regs.a = mem.read8(0x8083); m.step(0x32fc, 13); // 32f9  ld a,(0x8083)
    regs.and(regs.a); m.step(0x32fd, 4);
    if (regs.fNZ) { m.ret(11); return; }
    m.step(0x32fe, 5);
    regs.a = regs.inc8(regs.a); m.step(0x32ff, 4);
    mem.write8(0x8d32, regs.a); m.step(0x3302, 13); // 32ff  ld (0x8d32),a
    regs.hl = 0x8f24; m.step(0x3305, 10);
    regs.incMem8(mem, regs.hl); m.step(0x3306, 11); // 3305  inc (hl)
    m.ret();
    return;
  }
  m.step(0x32c6, 7);
  if (regs.fNC) { m.ret(11); return; } // 32c6  ret nc (state >= 3)
  m.step(0x32c7, 5);
  regs.xor(regs.a); m.step(0x32c8, 4);
  regs.hl = 0x8d21; m.step(0x32cb, 10);
  mem.write8(regs.hl, regs.a); m.step(0x32cc, 7); // 32cb  ld (hl),a
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x32cd, 6);
  mem.write8(regs.hl, 0x20); m.step(0x32cf, 10); // 32cd  ld (hl),0x20
  m.push16(0x32d2); m.step(0x0fad, 17); m.call(0x0fad);
  regs.hl = 0x8f24; m.step(0x32d5, 10);
  regs.incMem8(mem, regs.hl); m.step(0x32d6, 11); // 32d5  inc (hl)
  regs.hl = 0x0779; m.step(0x32d9, 10);
  regs.bc = 0x2000; m.step(0x32dc, 10);
  for (;;) {
    regs.a = mem.read8(regs.hl); m.step(0x32dd, 7); // 32dc  ld a,(hl)
    regs.add(regs.c); m.step(0x32de, 4);
    regs.c = regs.a; m.step(0x32df, 4);
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x32e0, 6);
    if (regs.djnz() !== 0) { m.step(0x32dc, 13); continue; }
    m.step(0x32e2, 8); break;
  }
  regs.and(0x47); m.step(0x32e4, 7);
  if (regs.fNZ) { m.step(0x1f40, 10); return m.call(0x1f40); } // 32e4  jp nz,0x1f40 (guard)
  m.step(0x32e7, 10);
  m.ret();
}
