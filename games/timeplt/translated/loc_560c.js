// SPDX-License-Identifier: GPL-3.0-only

// loc_560c  (ROM 0x560C-0x5616)
export function loc_560c(m) {
  const { regs, mem } = m;

  m.push16(regs.hl);
  m.step(0x560d, 11); // push hl
  m.push16(regs.af);
  m.step(0x560e, 11); // push af -- the sound code
  regs.a = mem.read8(0xad30);
  m.step(0x5611, 13); // ld a,(0xad30)
  regs.and(regs.a);
  m.step(0x5612, 4); // and a
  if (regs.fNZ) {
    m.step(0x562a, 12); // jr nz,0x562a -- TAIL into 0x562A, which owns that body
    return m.call(0x562a);
  }
  m.step(0x5614, 7); // jr nz not taken

  regs.af = m.pop16();
  m.step(0x5615, 10); // pop af
  regs.hl = m.pop16();
  m.step(0x5616, 10); // pop hl
  m.ret(10); // 5616
}
