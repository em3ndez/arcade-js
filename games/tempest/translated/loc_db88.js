// SPDX-License-Identifier: GPL-3.0-only
// loc_db88  (ROM 0xdb88-0xdb99) -- jsr 0xdf39, then zero $60c1,x and $60d1,x for x=6,4,2,0, rts.
export function loc_db88(m) {
  const { regs, mem } = m;
  m.push16((0xdb88 + 2) & 0xffff); m.step(0xdb8b, 6); m.call(0xdf39);
  regs.x = 0x06; regs.setNZ(regs.x); m.step(0xdb8d, 2);
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xdb8f, 2);
  do {
    mem.write8((0x60c1 + regs.x) & 0xffff, regs.a); m.step(0xdb92, 5);
    mem.write8((0x60d1 + regs.x) & 0xffff, regs.a); m.step(0xdb95, 5);
    regs.x = (regs.x - 1) & 0xff; regs.setNZ(regs.x); m.step(0xdb96, 2);
    regs.x = (regs.x - 1) & 0xff; regs.setNZ(regs.x); m.step(0xdb97, 2);
    if (!regs.fN) { m.step(0xdb8f, 3); } else { m.step(0xdb99, 2); break; }
  } while (true);
  return m.ret(6);
}
