// SPDX-License-Identifier: GPL-3.0-only

// loc_5ebd  (ROM 0x5ebd-0x5f01) -- one iteration of the 0x5e98 actor sweep (bit1-clear variant).
// Skips empty (hl)==0 or state (hl+2)>=4 slots, then screens the actor via loc_5f53 (fills E,A + a
// carry gate) and an |dx|<0x0a / |dy|<0x09 proximity window; any miss tail-jumps to the loop tail
// 0x5f06 (advance + djnz). On a hit it clears (hl) and writes 01/08 into hl+1/hl+2, reloads the
// latched target, and -- unless the target's (ix+0x07) bit0 is set (jr nz 0x5f02) -- rst-0x10 memsets
// 0x17 bytes at the target before falling through to loc_5f02 (call 0x0ef1; ret).
export function loc_5ebd(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(regs.hl);                        m.step(0x5ebe, 7);
  regs.and(regs.a);                                  m.step(0x5ebf, 4);
  if (regs.fZ) { m.step(0x5f06, 12); return m.call(0x5f06); } // jr z -- empty slot
  m.step(0x5ec1, 7);
  regs.l = regs.inc8(regs.l);                        m.step(0x5ec2, 4);
  regs.l = regs.inc8(regs.l);                        m.step(0x5ec3, 4);
  regs.a = mem.read8(regs.hl);                        m.step(0x5ec4, 7);
  regs.l = regs.dec8(regs.l);                        m.step(0x5ec5, 4);
  regs.l = regs.dec8(regs.l);                        m.step(0x5ec6, 4);
  regs.cp(0x04);                                     m.step(0x5ec8, 7);
  if (regs.fNC) { m.step(0x5f06, 12); return m.call(0x5f06); } // jr nc -- state >= 4
  m.step(0x5eca, 7);
  m.push16(0x5ecd);
  m.step(0x5f53, 17);                                // call 0x5f53 -- E,A + carry gate
  m.call(0x5f53);
  if (regs.fNC) { m.step(0x5f06, 12); return m.call(0x5f06); } // jr nc -- off-screen
  m.step(0x5ecf, 7);
  regs.d = regs.a;                                   m.step(0x5ed0, 4);
  regs.a = mem.read8((regs.iy + 0x00) & 0xffff);     m.step(0x5ed3, 19);
  regs.sub(regs.e);                                  m.step(0x5ed4, 4);
  if (regs.fNC) { m.step(0x5ed8, 12); } else { m.step(0x5ed6, 7); regs.neg(); m.step(0x5ed8, 8); } // |dx|
  regs.cp(0x0a);                                     m.step(0x5eda, 7);
  if (regs.fNC) { m.step(0x5f06, 12); return m.call(0x5f06); } // jr nc -- dx too far
  m.step(0x5edc, 7);
  regs.a = mem.read8((regs.iy + 0x02) & 0xffff);     m.step(0x5edf, 19);
  regs.add(0x08);                                    m.step(0x5ee1, 7);
  regs.sub(regs.d);                                  m.step(0x5ee2, 4);
  if (regs.fNC) { m.step(0x5ee6, 12); } else { m.step(0x5ee4, 7); regs.neg(); m.step(0x5ee6, 8); } // |dy|
  regs.cp(0x09);                                     m.step(0x5ee8, 7);
  if (regs.fNC) { m.step(0x5f06, 12); return m.call(0x5f06); } // jr nc -- dy too far
  m.step(0x5eea, 7);
  regs.xor(regs.a);                                  m.step(0x5eeb, 4); // hit: mark the slot caught
  mem.write8(regs.hl, regs.a);                       m.step(0x5eec, 7);
  regs.hl = (regs.hl + 1) & 0xffff;                  m.step(0x5eed, 6);
  mem.write8(regs.hl, 0x01);                         m.step(0x5eef, 10);
  regs.hl = (regs.hl + 1) & 0xffff;                  m.step(0x5ef0, 6);
  mem.write8(regs.hl, 0x08);                         m.step(0x5ef2, 10);
  regs.ix = mem.read16(0x8d65);                      m.step(0x5ef6, 20);
  regs.bit(0, mem.read8((regs.ix + 0x07) & 0xffff)); m.step(0x5efa, 20);
  if (regs.fNZ) { m.step(0x5f02, 12); return m.call(0x5f02); } // jr nz -- skip the memset
  m.step(0x5efc, 7);
  regs.hl = mem.read16(0x8d65);                      m.step(0x5eff, 16);
  regs.b = 0x17;                                     m.step(0x5f01, 7);
  m.push16(0x5f02);
  m.step(0x0010, 11);                                // rst 0x10 -- memset 0x17 bytes, returns to 0x5f02
  m.call(0x0010);
  return m.call(0x5f02);                             // fall through to loc_5f02 (call 0x0ef1; ret)
}
