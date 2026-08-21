// SPDX-License-Identifier: GPL-3.0-only

// loc_683a  (ROM 0x683a-0x6856) -- advance an object to its next state: bump the +0x02 phase, zero
// the +0x03/+0x05 sub-position fields, seat +0x04=0x08 / +0x06=0x1e, run loc_381e with the 0x68ef
// parameter block, then set +0x09=0x18.
export function loc_683a(m) {
  const { regs, mem } = m;

  regs.incMem8(mem, (regs.ix + 0x02) & 0xffff); m.step(0x683d, 23);
  regs.xor(regs.a);            m.step(0x683e, 4);
  mem.write8((regs.ix + 0x03) & 0xffff, regs.a); m.step(0x6841, 19);
  mem.write8((regs.ix + 0x05) & 0xffff, regs.a); m.step(0x6844, 19);
  mem.write8((regs.ix + 0x04) & 0xffff, 0x08);   m.step(0x6848, 19);
  mem.write8((regs.ix + 0x06) & 0xffff, 0x1e);   m.step(0x684c, 19);
  regs.de = 0x68ef;            m.step(0x684f, 10);
  m.push16(0x6852); m.step(0x381e, 17); m.call(0x381e);
  mem.write8((regs.ix + 0x09) & 0xffff, 0x18);   m.step(0x6856, 19);
  return m.ret(10);
}
