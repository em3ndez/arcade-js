// SPDX-License-Identifier: GPL-3.0-only
// loc_c2e8  (ROM 0xc2e8-0xc30c) -- clamps A (<0x62 else masks $60ca&$5f), divides by 0x10 into X counting
// the remainder in A, indexes table $bc7c,y, stores to $0112, then A = (tableVal<<4)|0x0f; rts.
export function loc_c2e8(m) {
  const { regs, mem } = m;
  regs.x = 0x00; regs.setNZ(regs.x); m.step(0xc2ea, 2);
  regs.cmp(0x62); m.step(0xc2ec, 2);
  if (regs.fNC) {
    m.step(0xc2f3, 3);
  } else {
    m.step(0xc2ee, 2);
    regs.a = mem.read8(0x60ca); regs.setNZ(regs.a); m.step(0xc2f1, 4);
    regs.and(0x5f); m.step(0xc2f3, 2);
  }
  regs.cmp(0x10); m.step(0xc2f5, 2);
  while (true) {
    if (regs.fNC) {
      m.step(0xc2fb, 3);
    } else {
      m.step(0xc2f7, 2);
      regs.x = regs.inc8(regs.x); m.step(0xc2f8, 2);
      regs.sec(); m.step(0xc2f9, 2);
      regs.sbc(0x10); m.step(0xc2fb, 2);
    }
    regs.cmp(0x10); m.step(0xc2fd, 2);
    if (regs.fC) { m.step(0xc2f5, 3); continue; }
    m.step(0xc2ff, 2); break;
  }
  regs.y = regs.a; regs.setNZ(regs.y); m.step(0xc300, 2);
  regs.a = mem.read8((0xbc7c + regs.y) & 0xffff); regs.setNZ(regs.a); m.step(0xc303, 4);
  mem.write8(0x0112, regs.a); m.step(0xc306, 4);
  regs.a = regs.asl(regs.a); m.step(0xc307, 2);
  regs.a = regs.asl(regs.a); m.step(0xc308, 2);
  regs.a = regs.asl(regs.a); m.step(0xc309, 2);
  regs.a = regs.asl(regs.a); m.step(0xc30a, 2);
  regs.ora(0x0f); m.step(0xc30c, 2);
  return m.ret(6);
}
