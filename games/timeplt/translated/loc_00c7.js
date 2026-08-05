// SPDX-License-Identifier: GPL-3.0-only

// loc_00c7  (ROM 0x00C7-0x00D7)
export function loc_00c7(m) {
  const { regs, mem } = m;

  m.push16(regs.hl);
  m.step(0x00c8, 11); // push hl
  mem.write8(regs.hl, 0x56);
  m.step(0x00ca, 10); // ld (hl),0x56
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x00cb, 6); // inc hl
  mem.write8(regs.hl, 0x83);
  m.step(0x00cd, 10); // ld (hl),0x83
  regs.de = 0x001f;
  m.step(0x00d0, 10); // ld de,0x001f
  regs.addHl(regs.de);
  m.step(0x00d1, 11); // add hl,de
  mem.write8(regs.hl, 0xc7);
  m.step(0x00d3, 10); // ld (hl),0xc7
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x00d4, 6); // inc hl
  mem.write8(regs.hl, 0xef);
  m.step(0x00d6, 10); // ld (hl),0xef
  regs.hl = m.pop16();
  m.step(0x00d7, 10); // pop hl -- restores the caller's pointer
  m.ret(10); // 00d7
}
