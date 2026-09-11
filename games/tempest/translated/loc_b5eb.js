// SPDX-License-Identifier: GPL-3.0-only
// loc_b5eb  (ROM 0xb5eb-0xb60a) -- jump-table entry (loc_b5d7 Y=0). Sets $9e=3. If slot x's $0283,x is
// negative, calls loc_b634 then loc_bdcb with Y=0; otherwise loads Y=$02b9,x and A=table $b60b[$55],
// then calls loc_bda0. `clv; bvc` is an unconditional join to the rts. abs,x reads model page-cross +1.
export function loc_b5eb(m) {
  const { regs, mem } = m;
  L_b60a: {
    L_b602: {
      regs.a = 0x03; regs.setNZ(regs.a); m.step(0xb5ed, 2);
      mem.write8(0x9e, regs.a); m.step(0xb5ef, 3);
      { const a = (0x0283 + regs.x) & 0xffff;
        regs.a = mem.read8(a); regs.setNZ(regs.a); m.step(0xb5f2, 4 + ((0x0283 & 0xff00) !== (a & 0xff00) ? 1 : 0)); }
      if (regs.fN) { m.step(0xb602, 3); break L_b602; } // bmi 0xb602: same-page taken = 3 (no cross)
      m.step(0xb5f4, 2);
      { const a = (0x02b9 + regs.x) & 0xffff;
        regs.y = mem.read8(a); regs.setNZ(regs.y); m.step(0xb5f7, 4 + ((0x02b9 & 0xff00) !== (a & 0xff00) ? 1 : 0)); }
      regs.x = mem.read8(0x55); regs.setNZ(regs.x); m.step(0xb5f9, 3);
      { const a = (0xb60b + regs.x) & 0xffff;
        regs.a = mem.read8(a); regs.setNZ(regs.a); m.step(0xb5fc, 4 + ((0xb60b & 0xff00) !== (a & 0xff00) ? 1 : 0)); }
      m.push16(0xb5fe); m.step(0xb5ff, 6); m.call(0xbda0);
      regs.clv(); m.step(0xb600, 2);
      m.step(0xb60a, 3); break L_b60a;
    }
    m.push16(0xb604); m.step(0xb605, 6); m.call(0xb634);
    regs.y = 0x00; regs.setNZ(regs.y); m.step(0xb607, 2);
    m.push16(0xb609); m.step(0xb60a, 6); m.call(0xbdcb);
  }
  return m.ret(6);
}
