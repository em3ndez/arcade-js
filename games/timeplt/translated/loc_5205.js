// SPDX-License-Identifier: GPL-3.0-only

// loc_5205  (ROM 0x5205-0x5210, Time Pilot)
export function loc_5205(m) {
  const { regs, mem } = m;

  regs.hl = 0xa99d;
  m.step(0x5208, 10); // ld hl,0xa99d
  regs.a = mem.read8(regs.hl);
  m.step(0x5209, 7); // ld a,(hl)
  regs.and(regs.a);
  m.step(0x520a, 4); // and a
  if (regs.fZ) {
    m.step(0x520e, 12); // jr z,0x520e taken -- already expired

    regs.l = regs.inc8(regs.l);
    m.step(0x520f, 4); // inc l -- 0xA99E
    mem.write8(regs.hl, regs.a); // A is 0 here
    m.step(0x5210, 7); // ld (hl),a
    m.ret(10); // ret
    return;
  }
  m.step(0x520c, 7); // jr z NOT taken

  regs.decMem8(mem, regs.hl);
  m.step(0x520d, 11); // dec (hl)
  m.ret(10); // ret
}
