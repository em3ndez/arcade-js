// SPDX-License-Identifier: GPL-3.0-only
// loc_a398  (ROM 0xa398-0xa3c4) -- picks a value from $02b9,y (decremented unless $0283,y top-2 bits set),
// stores $2d, calls 0xa3ca/0xa06f, then indexes table 0xa3c5,y and tail-jumps 0xca6c.
// Cycle notes: abs,y reads charge 4 (+1 when the index carries into a new page); the clv+bvc pair is an
// unconditional forward skip (V just cleared -> always taken).
export function loc_a398(m) {
  const { regs, mem } = m;
  let ea;
  ea = (0x0283 + regs.y) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a);
  m.step(0xa39b, (ea & 0xff00) !== 0x0200 ? 5 : 4);
  regs.and(0xc0); m.step(0xa39d, 2);
  regs.cmp(0xc0); m.step(0xa39f, 2);
  if (regs.fZ) {
    m.step(0xa3a7, 3);
    ea = (0x02b9 + regs.y) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a);
    m.step(0xa3aa, (ea & 0xff00) !== 0x0200 ? 5 : 4);
    regs.sec(); m.step(0xa3ab, 2);
    regs.sbc(0x01); m.step(0xa3ad, 2);
    regs.and(0x0f); m.step(0xa3af, 2);
  } else {
    m.step(0xa3a1, 2);
    ea = (0x02b9 + regs.y) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a);
    m.step(0xa3a4, (ea & 0xff00) !== 0x0200 ? 5 : 4);
    regs.clv(); m.step(0xa3a5, 2);
    m.step(0xa3af, 3);
  }
  mem.write8(0x2d, regs.a); m.step(0xa3b1, 3);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xa3b3, 2);
  m.push16(0xa3b5); m.step(0xa3b6, 6); m.call(0xa3ca);
  m.push16(0xa3b8); m.step(0xa3b9, 6); m.call(0xa06f);
  ea = (0x0283 + regs.y) & 0xffff; regs.a = mem.read8(ea); regs.setNZ(regs.a);
  m.step(0xa3bc, (ea & 0xff00) !== 0x0200 ? 5 : 4);
  regs.and(0x07); m.step(0xa3be, 2);
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xa3bf, 2);// a3be tay
  ea = (0xa3c5 + regs.y) & 0xffff; regs.x = mem.read8(ea); regs.setNZ(regs.x);
  m.step(0xa3c2, (ea & 0xff00) !== 0xa300 ? 5 : 4);
  m.step(0xca6c, 3); return m.call(0xca6c);
}
