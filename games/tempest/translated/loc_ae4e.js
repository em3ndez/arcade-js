// SPDX-License-Identifier: GPL-3.0-only
// loc_ae4e  (ROM 0xae4e-0xaec9) -- do-while over 0x37 (step -3 from 0x15): per pass calls a chain of
// draw/vector helpers, seeds $56-$58 from the $0706 table, loops while 0x37 stays non-negative (bpl).
export function loc_ae4e(m) {
  const { regs, mem } = m;
  mem.write8(0x63, regs.a); m.step(0xae50, 3);
  regs.x = 0x10; regs.setNZ(regs.x); m.step(0xae52, 2);
  m.push16(0xae54); m.step(0xae55, 6); m.call(0xab14);
  regs.a = 0x01; regs.setNZ(regs.a); m.step(0xae57, 2);
  mem.write8(0x61, regs.a); m.step(0xae59, 3);
  m.push16(0xae5b); m.step(0xae5c, 6); m.call(0xb0dd);
  regs.a = 0x28; regs.setNZ(regs.a); m.step(0xae5e, 2);
  mem.write8(0x2c, regs.a); m.step(0xae60, 3);
  regs.x = 0x15; regs.setNZ(regs.x); m.step(0xae62, 2);
  mem.write8(0x37, regs.x); m.step(0xae64, 3);

  let branchTaken;
  do {
    m.push16(0xae66); m.step(0xae67, 6); m.call(0xab0d);
    regs.a = 0x00; regs.setNZ(regs.a); m.step(0xae69, 2);
    mem.write8(0x73, regs.a); m.step(0xae6b, 3);
    regs.a = mem.read8(0x2c); regs.setNZ(regs.a); m.step(0xae6d, 3);
    regs.x = regs.a; regs.setNZ(regs.x); m.step(0xae6e, 2);
    regs.sec(); m.step(0xae6f, 2);
    regs.sbc(0x0a); m.step(0xae71, 2);
    mem.write8(0x2c, regs.a); m.step(0xae73, 3);
    regs.a = 0xd0; regs.setNZ(regs.a); m.step(0xae75, 2);
    m.push16(0xae77); m.step(0xae78, 6); m.call(0xdf75);
    regs.y = 0x07; regs.setNZ(regs.y); m.step(0xae7a, 2);
    regs.a = mem.read8(0x63); regs.setNZ(regs.a); m.step(0xae7c, 3);
    regs.cmp(mem.read8(0x37)); m.step(0xae7e, 3);
    if (regs.fNZ) { m.step(0xae82, 3); }
    else {
      m.step(0xae80, 2);
      regs.y = 0x00; regs.setNZ(regs.y); m.step(0xae82, 2);
    }
    m.push16(0xae84); m.step(0xae85, 6); m.call(0xb0d1);
    regs.a = 0x61; regs.setNZ(regs.a); m.step(0xae87, 2);
    regs.y = 0x01; regs.setNZ(regs.y); m.step(0xae89, 2);
    m.push16(0xae8b); m.step(0xae8c, 6); m.call(0xdfb1);
    regs.a = 0xa0; regs.setNZ(regs.a); m.step(0xae8e, 2);
    m.push16(0xae90); m.step(0xae91, 6); m.call(0xb56a);
    regs.a = 0x00; regs.setNZ(regs.a); m.step(0xae93, 2);
    mem.write8(0x73, regs.a); m.step(0xae95, 3);
    regs.x = regs.a; regs.setNZ(regs.x); m.step(0xae96, 2);
    regs.a = 0x08; regs.setNZ(regs.a); m.step(0xae98, 2);
    m.push16(0xae9a); m.step(0xae9b, 6); m.call(0xdf75);
    mem.write8(0x61, regs.inc8(mem.read8(0x61))); m.step(0xae9d, 5);
    regs.a = mem.read8(0x37); regs.setNZ(regs.a); m.step(0xae9f, 3);
    m.push16(0xaea1); m.step(0xaea2, 6); m.call(0xaef8);
    regs.x = 0x00; regs.setNZ(regs.x); m.step(0xaea4, 2);
    regs.a = 0x08; regs.setNZ(regs.a); m.step(0xaea6, 2);
    m.push16(0xaea8); m.step(0xaea9, 6); m.call(0xdf75);
    regs.x = mem.read8(0x37); regs.setNZ(regs.x); m.step(0xaeab, 3);
    regs.a = mem.read8((0x0706 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xaeae, 4);
    mem.write8(0x56, regs.a); m.step(0xaeb0, 3);
    regs.a = mem.read8((0x0707 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xaeb3, 4);
    mem.write8(0x57, regs.a); m.step(0xaeb5, 3);
    regs.a = mem.read8((0x0708 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xaeb8, 4);
    mem.write8(0x58, regs.a); m.step(0xaeba, 3);
    regs.a = 0x56; regs.setNZ(regs.a); m.step(0xaebc, 2);
    regs.y = 0x03; regs.setNZ(regs.y); m.step(0xaebe, 2);
    m.push16(0xaec0); m.step(0xaec1, 6); m.call(0xdfb1);
    mem.write8(0x37, regs.dec8(mem.read8(0x37))); m.step(0xaec3, 5);
    mem.write8(0x37, regs.dec8(mem.read8(0x37))); m.step(0xaec5, 5);
    mem.write8(0x37, regs.dec8(mem.read8(0x37))); m.step(0xaec7, 5);
    branchTaken = !regs.fN;
    m.step(branchTaken ? 0xae64 : 0xaec9, branchTaken ? 3 : 2);
  } while (branchTaken);

  return m.ret(6);
}
