// SPDX-License-Identifier: GPL-3.0-only

// loc_66c5  (ROM 0x66c5-0x66f0) -- steps three actor records (stride 0x18) through the loc_66f1 pass
// with the alt register bank active across each call, then -- when the (0x8ae2) flag is set -- runs the
// (0x892d) countdown: on a live count decrement and ret, on zero reload it to 0x10, bump (0x892f), and
// enqueue display command 0x0612 (0x0692 when bit 0 of (0x892f) is clear) via rst 0x38.
export function loc_66c5(m) {
  const { regs, mem } = m;

  regs.de = 0x0018;  m.step(0x66c8, 10);
  regs.b = 0x03;     m.step(0x66ca, 7);
  for (;;) {
    regs.exx();      m.step(0x66cb, 4); // 66ca  exx -- alt bank for the call
    m.push16(0x66ce); m.step(0x66f1, 17); m.call(0x66f1);
    regs.exx();      m.step(0x66cf, 4); // 66ce  exx -- restore loop bank
    regs.addIx(regs.de); m.step(0x66d1, 15);
    if (regs.djnz() !== 0) { m.step(0x66ca, 13); continue; } // 66d1  djnz 0x66ca
    m.step(0x66d3, 8);
    break;
  }
  regs.a = mem.read8(0x8ae2); m.step(0x66d6, 13);
  regs.and(regs.a);           m.step(0x66d7, 4);
  if (regs.fZ) { return m.ret(11); } // 66d7  ret z -- flag clear
  m.step(0x66d8, 5);

  regs.hl = 0x892d;           m.step(0x66db, 10);
  regs.a = mem.read8(regs.hl); m.step(0x66dc, 7);
  regs.and(regs.a);           m.step(0x66dd, 4);
  if (regs.fZ) {
    m.step(0x66e1, 12); // 66dd  jr z,0x66e1 -- count expired
  } else {
    m.step(0x66df, 7);
    regs.decMem8(mem, regs.hl); m.step(0x66e0, 11);
    return m.ret(10); // 66e0  ret
  }
  mem.write8(regs.hl, 0x10);  m.step(0x66e3, 10);
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x66e4, 6);
  regs.hl = (regs.hl + 1) & 0xffff; m.step(0x66e5, 6);
  regs.incMem8(mem, regs.hl); m.step(0x66e6, 11);
  regs.bit(0, mem.read8(regs.hl)); m.step(0x66e8, 12);
  regs.de = 0x0612;           m.step(0x66eb, 10);
  if (regs.fNZ) {
    m.step(0x66ef, 12); // 66eb  jr nz,0x66ef
  } else {
    m.step(0x66ed, 7);
    regs.e = 0x92;            m.step(0x66ef, 7); // 66ed  ld e,0x92 -> DE=0x0692
  }
  m.push16(0x66f0); m.step(0x0038, 11); m.call(0x0038); // 66ef  rst 0x38
  return m.ret(10); // 66f0  ret
}
