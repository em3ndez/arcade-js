// SPDX-License-Identifier: GPL-3.0-only

// loc_4acc  (ROM 0x4ACC–0x4AFA)
export function loc_4acc(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xa9b1);
  m.step(0x4acf, 13); // ld a,(0xa9b1)
  regs.and(0x0f);
  m.step(0x4ad1, 7); // and 0x0f
  regs.cp(0x0f);
  m.step(0x4ad3, 7); // cp 0x0f

  if (regs.fNZ) {
    m.step(0x4ada, 12); // jr nz,0x4ada
  } else {
    m.step(0x4ad5, 7); // jr nz -- not taken
    regs.hl = 0xa9c0;
    m.step(0x4ad8, 10); // ld hl,0xa9c0
    mem.write8(regs.hl, 0xff);
    m.step(0x4ada, 10); // ld (hl),0xff
  }

  regs.hl = 0x4b95;
  m.step(0x4add, 10); // ld hl,0x4b95
  m.push16(0x4ade);
  m.step(0x0008, 11); // rst 0x08 -- A = table byte at 0x4B95 + A
  m.call(0x0008);
  mem.write8(0xa9c9, regs.a);
  m.step(0x4ae1, 13); // ld (0xa9c9),a

  regs.a = mem.read8(0xa9b1);
  m.step(0x4ae4, 13); // ld a,(0xa9b1)
  regs.rrca();
  m.step(0x4ae5, 4); // rrca
  regs.rrca();
  m.step(0x4ae6, 4); // rrca
  regs.rrca();
  m.step(0x4ae7, 4); // rrca
  regs.rrca();
  m.step(0x4ae8, 4); // rrca
  regs.and(0x0f);
  m.step(0x4aea, 7); // and 0x0f
  regs.cp(0x0f);
  m.step(0x4aec, 7); // cp 0x0f

  if (regs.fNZ) {
    m.step(0x4af3, 12); // jr nz,0x4af3
  } else {
    m.step(0x4aee, 7); // jr nz -- not taken
    regs.hl = 0xa9c0;
    m.step(0x4af1, 10); // ld hl,0xa9c0
    mem.write8(regs.hl, 0xff);
    m.step(0x4af3, 10); // ld (hl),0xff
  }

  regs.hl = 0x4b95;
  m.step(0x4af6, 10); // ld hl,0x4b95
  m.push16(0x4af7);
  m.step(0x0008, 11); // rst 0x08
  m.call(0x0008);
  mem.write8(0xa9cc, regs.a);
  m.step(0x4afa, 13); // ld (0xa9cc),a

  m.ret(10); // ret (0x4AFA)
}
