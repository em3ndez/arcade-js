// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1880  (ROM 0x1880–0x18C5) — 0x1644 idx 4: gated object setup (0x691B==0xD0 -> spawn record + advance).
 */
export function loc_1880(m) {
  const { regs, mem } = m;
  regs.hl = 0x690b;
  m.step(0x1883, 10); // ld hl,0x690b
  regs.c = 0x01;
  m.step(0x1885, 7); // ld c,0x01
  m.push16(0x1886); m.step(0x0038, 11); m.call(0x0038); // rst 0x38 add-loop
  regs.a = mem.read8(0x691b);
  m.step(0x1889, 13); // ld a,(0x691b)
  regs.cp(0xd0);
  m.step(0x188b, 7); // cp 0xd0
  if (regs.fNZ) { m.ret(11); return; } // ret nz
  m.step(0x188c, 5);
  regs.a = 0x20;
  m.step(0x188e, 7); // ld a,0x20
  mem.write8(0x6919, regs.a);
  m.step(0x1891, 13); // ld (0x6919),a
  regs.hl = 0x6a24;
  m.step(0x1894, 10); // ld hl,0x6a24
  mem.write8(regs.hl, 0x7f);
  m.step(0x1896, 10); // ld (hl),0x7f
  regs.l = regs.inc8(regs.l);
  m.step(0x1897, 4); // inc l
  mem.write8(regs.hl, 0x39);
  m.step(0x1899, 10); // ld (hl),0x39
  regs.l = regs.inc8(regs.l);
  m.step(0x189a, 4); // inc l
  mem.write8(regs.hl, 0x01);
  m.step(0x189c, 10); // ld (hl),0x01
  regs.l = regs.inc8(regs.l);
  m.step(0x189d, 4); // inc l
  mem.write8(regs.hl, 0xd8);
  m.step(0x189f, 10); // ld (hl),0xd8 -- record 7F 39 01 D8
  regs.hl = 0x76c6;
  m.step(0x18a2, 10); // ld hl,0x76c6
  m.push16(0x18a5); m.step(0x1826, 17); m.call(0x1826);
  regs.de = 0x3a5f;
  m.step(0x18a8, 10); // ld de,0x3a5f
  m.push16(0x18ab); m.step(0x0da7, 17); m.call(0x0da7);
  regs.de = 0x0004;
  m.step(0x18ae, 10); // ld de,0x0004
  regs.bc = 0x0228;
  m.step(0x18b1, 10); // ld bc,0x0228 (B=2 loop count, C=0x28 addend)
  regs.hl = 0x6903;
  m.step(0x18b4, 10); // ld hl,0x6903
  m.push16(0x18b7); m.step(0x003d, 17); m.call(0x003d); // DIRECT add-loop body (B=2)
  regs.a = 0x00;
  m.step(0x18b9, 7); // ld a,0x00
  mem.write8(0x62af, regs.a);
  m.step(0x18bc, 13); // ld (0x62af),a
  regs.a = 0x03;
  m.step(0x18be, 7); // ld a,0x03
  mem.write8(0x6082, regs.a);
  m.step(0x18c1, 13); // ld (0x6082),a
  regs.hl = 0x6388;
  m.step(0x18c4, 10); // ld hl,0x6388
  regs.incMem8(mem, regs.hl); // inc (hl) -- advance selector
  m.step(0x18c5, 11);
  m.ret();
}
