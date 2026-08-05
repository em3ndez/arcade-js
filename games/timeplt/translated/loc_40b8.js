// SPDX-License-Identifier: GPL-3.0-only

// loc_40b8  (ROM 0x40B8–0x40D5)
export function loc_40b8(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xad04);
  m.step(0x40bb, 13); // ld a,(0xad04)
  regs.cp(0x02);
  m.step(0x40bd, 7); // cp 0x02
  if (regs.fC) {
    m.ret(11); // ret c
    return;
  }
  m.step(0x40be, 5); // ret c NOT taken

  regs.a = mem.read8(0xa980);
  m.step(0x40c1, 13); // ld a,(0xa980)
  regs.and(0x1f);
  m.step(0x40c3, 7); // and 0x1f
  if (regs.fNZ) {
    m.ret(11); // ret nz
    return;
  }
  m.step(0x40c4, 5); // ret nz NOT taken

  regs.a = mem.read8(0xa8c0);
  m.step(0x40c7, 13); // ld a,(0xa8c0)
  regs.a = regs.inc8(regs.a);
  m.step(0x40c8, 4); // inc a -- Z iff the slot held 0xFF
  if (regs.fZ) {
    m.ret(11); // ret z
    return;
  }
  m.step(0x40c9, 5); // ret z NOT taken

  regs.a = mem.read8(0xa8d0);
  m.step(0x40cc, 13); // ld a,(0xa8d0)
  regs.a = regs.inc8(regs.a);
  m.step(0x40cd, 4); // inc a
  if (regs.fZ) {
    m.ret(11); // ret z
    return;
  }
  m.step(0x40ce, 5); // ret z NOT taken

  regs.a = mem.read8(0xa8e0);
  m.step(0x40d1, 13); // ld a,(0xa8e0)
  regs.a = regs.inc8(regs.a);
  m.step(0x40d2, 4); // inc a
  if (regs.fZ) {
    m.ret(11); // ret z
    return;
  }
  m.step(0x40d3, 5); // ret z NOT taken

  m.step(0x5679, 10); // jp 0x5679 -- TAIL jump, nothing pushed
  return m.call(0x5679);
}
