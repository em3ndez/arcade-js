// SPDX-License-Identifier: GPL-3.0-only

// loc_4b4b  (ROM 0x4B4B–0x4B66)
export function loc_4b4b(m) {
  const { regs, mem } = m;

  regs.exx();
  m.step(0x4b4c, 4); // exx
  regs.hl = 0xab3f;
  m.step(0x4b4f, 10); // ld hl,0xab3f
  regs.de = 0xab40;
  m.step(0x4b52, 10); // ld de,0xab40
  regs.bc = 0x0010;
  m.step(0x4b55, 10); // ld bc,0x0010

  m.lddrAt(0x4b55, 0x4b57); // 4b55  lddr -- 0xAB30..0xAB3F -> 0xAB31..0xAB40

  regs.hl = 0xab40;
  m.step(0x4b5a, 10); // ld hl,0xab40
  regs.a = mem.read8(0xab37);
  m.step(0x4b5d, 13); // ld a,(0xab37)
  regs.xor(mem.read8(regs.hl));
  m.step(0x4b5e, 7); // xor (hl)
  mem.write8(0xab30, regs.a);
  m.step(0x4b61, 13); // ld (0xab30),a
  regs.hl = 0xa980;
  m.step(0x4b64, 10); // ld hl,0xa980
  regs.add(mem.read8(regs.hl));
  m.step(0x4b65, 7); // add a,(hl)
  regs.exx();
  m.step(0x4b66, 4); // exx

  m.ret(10); // ret (0x4B66)
}
