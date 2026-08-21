// SPDX-License-Identifier: GPL-3.0-only

// loc_66fd  (ROM 0x66fd-0x6729) -- gated by the (0x8930) flag; runs the (0x892e) countdown. On a live
// count it decrements and rets; on zero it reloads 0x12, bumps the actor's (ix+0x02) phase, clears the
// (ix+0x03/0x05) fields and seats (ix+0x04)=0x15 / (ix+0x06)=0x02, points the animation at table 0x3829
// via loc_381e, and stores the tile id 0x2c into (ix+0x09).
export function loc_66fd(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8930);  m.step(0x6700, 13);
  regs.and(regs.a);            m.step(0x6701, 4);
  if (regs.fZ) { return m.ret(11); } // 6701  ret z -- flag clear
  m.step(0x6702, 5);

  regs.hl = 0x892e;            m.step(0x6705, 10);
  regs.a = mem.read8(regs.hl); m.step(0x6706, 7);
  regs.and(regs.a);            m.step(0x6707, 4);
  if (regs.fZ) {
    m.step(0x670b, 12); // 6707  jr z,0x670b -- count expired
  } else {
    m.step(0x6709, 7);
    regs.decMem8(mem, regs.hl); m.step(0x670a, 11);
    return m.ret(10); // 670a  ret
  }
  mem.write8(regs.hl, 0x12);   m.step(0x670d, 10);
  regs.incMem8(mem, (regs.ix + 0x02) & 0xffff); m.step(0x6710, 23);
  regs.xor(regs.a);            m.step(0x6711, 4);
  mem.write8((regs.ix + 0x03) & 0xffff, regs.a); m.step(0x6714, 19);
  mem.write8((regs.ix + 0x05) & 0xffff, regs.a); m.step(0x6717, 19);
  mem.write8((regs.ix + 0x04) & 0xffff, 0x15); m.step(0x671b, 19);
  mem.write8((regs.ix + 0x06) & 0xffff, 0x02); m.step(0x671f, 19);
  regs.de = 0x3829;            m.step(0x6722, 10);
  m.push16(0x6725); m.step(0x381e, 17); m.call(0x381e); // 6722  call 0x381e
  mem.write8((regs.ix + 0x09) & 0xffff, 0x2c); m.step(0x6729, 19);
  return m.ret(10); // 6729  ret
}
