// SPDX-License-Identifier: GPL-3.0-only

// loc_400b  (ROM 0x400B-0x4016, with the loop head at 0x3FF9)
export function loc_400b(m) {
  const { regs, mem } = m;

  for (;;) {
    regs.de = 0x0010;
    m.step(0x400e, 10); // ld de,0x0010
    regs.addIx(regs.de);
    m.step(0x4010, 15); // add ix,de
    regs.iy = (regs.iy + 1) & 0xffff;
    m.step(0x4012, 10); // inc iy
    regs.iy = (regs.iy + 1) & 0xffff;
    m.step(0x4014, 10); // inc iy

    if (regs.djnz() === 0) {
      m.step(0x4016, 8); // djnz NOT taken
      m.ret(); // 4016
      return;
    }
    m.step(0x3ff9, 13); // djnz 0x3ff9 taken -- an interior back edge, not an entry

    regs.a = mem.read8((regs.ix + 0x00) & 0xffff);
    m.step(0x3ffc, 19); // ld a,(ix+0x00)
    regs.and(regs.a);
    m.step(0x3ffd, 4); // and a
    if (regs.fZ) {
      m.step(0x400b, 10); // jp z,0x400b taken -- empty slot
      continue;
    }
    m.step(0x4000, 10); // jp z NOT taken

    regs.a = regs.inc8(regs.a); // Z iff (ix+0x00) was 0xFF
    m.step(0x4001, 4); // inc a
    if (regs.fNZ) {
      m.step(0x4008, 12); // jr nz,0x4008 taken -- TAIL, nothing pushed
      return m.call(0x4008);
    }
    m.step(0x4003, 7); // jr nz NOT taken -- (ix+0x00) was 0xFF

    m.push16(0x4006);
    m.step(0x4017, 17); // call 0x4017
    m.call(0x4017);

    m.step(0x400b, 12); // jr 0x400b
  }
}
