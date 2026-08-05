// SPDX-License-Identifier: GPL-3.0-only

// loc_2bba  (ROM 0x2BBA-0x2BDD, Time Pilot)
export function loc_2bba(m) {
  const { regs, mem } = m;

  m.push16(0x2bbd);
  m.step(0x5683, 17); // call 0x5683
  m.call(0x5683);

  regs.hl = 0xad02;
  m.step(0x2bc0, 10); // ld hl,0xad02
  regs.a = mem.read8(regs.hl);
  m.step(0x2bc1, 7); // ld a,(hl)
  regs.and(regs.a);
  m.step(0x2bc2, 4); // and a -- Z iff already zero
  if (regs.fZ) {
    m.step(0x2bc5, 12); // jr z,0x2bc5 taken -- do not wrap past zero
  } else {
    m.step(0x2bc4, 7); // jr z NOT taken
    regs.decMem8(mem, regs.hl);
    m.step(0x2bc5, 11); // dec (hl)
  }

  regs.a = mem.read8((regs.ix + 0x0e) & 0xffff);
  m.step(0x2bc8, 19); // ld a,(ix+0x0e)
  regs.bit(7, regs.a);
  m.step(0x2bca, 8); // bit 7,a
  if (regs.fZ) {
    m.ret(11); // ret z taken
    return;
  }
  m.step(0x2bcb, 5); // ret z NOT taken

  regs.a = mem.read8(0xa812);
  m.step(0x2bce, 13); // ld a,(0xa812)
  regs.and(regs.a);
  m.step(0x2bcf, 4); // and a
  if (regs.fZ) {
    m.ret(11); // ret z taken
    return;
  }
  m.step(0x2bd0, 5); // ret z NOT taken

  regs.hl = 0xa811;
  m.step(0x2bd3, 10); // ld hl,0xa811
  regs.decMem8(mem, regs.hl);
  m.step(0x2bd4, 11); // dec (hl)
  if (regs.fNZ) {
    m.ret(11); // ret nz taken -- timer still running
    return;
  }
  m.step(0x2bd5, 5); // ret nz NOT taken -- timer expired

  regs.a = mem.read8((regs.ix + 0x0f) & 0xffff);
  m.step(0x2bd8, 19); // ld a,(ix+0x0f)
  regs.add(0x80);
  m.step(0x2bda, 7); // add a,0x80
  mem.write8(0xa821, regs.a);
  m.step(0x2bdd, 13); // ld (0xa821),a
  m.ret(10); // ret
}
