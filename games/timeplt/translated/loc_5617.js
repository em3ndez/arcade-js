// SPDX-License-Identifier: GPL-3.0-only

// loc_5617  (ROM 0x5617-0x5627, Time Pilot)
export function loc_5617(m) {
  const { regs, mem } = m;

  m.push16(regs.hl);
  m.step(0x5618, 11); // push hl

  m.push16(regs.af);
  m.step(0x5619, 11); // push af -- preserve the request code in A

  regs.a = mem.read8(0xad30);
  m.step(0x561c, 13); // ld a,(0xad30)

  regs.and(regs.a);
  m.step(0x561d, 4); // and a -- zero test

  if (regs.fNZ) {
    m.step(0x562a, 12); // jr nz,0x562a taken
    return m.call(0x562a);
  }
  m.step(0x561f, 7); // jr nz not taken

  regs.a = mem.read8(0xa9c6);
  m.step(0x5622, 13); // ld a,(0xa9c6)

  regs.and(regs.a);
  m.step(0x5623, 4); // and a -- zero test

  if (regs.fNZ) {
    m.step(0x562a, 12); // jr nz,0x562a taken
    return m.call(0x562a);
  }
  m.step(0x5625, 7); // jr nz not taken -- both gates clear, drop the request

  regs.af = m.pop16();
  m.step(0x5626, 10); // pop af

  regs.hl = m.pop16();
  m.step(0x5627, 10); // pop hl

  m.ret(); // 5627  ret
}
