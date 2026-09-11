// SPDX-License-Identifier: GPL-3.0-only
// loc_a23f  (ROM 0xa23f-0xa2a5) -- returns if $0201 negative. If $05 negative, gate on $4d & 0x10;
// else count $02b5,x within 2 of $0200 over x=0x0a..0 into $29 and gate on that. When gated, scan
// x=7..0 for a free $02d3,x slot: inc $0135, seed $02d3/$02ad/$02c0/$02f2, jsr ccea, jsr a463.
export function loc_a23f(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x0201); regs.setNZ(regs.a); m.step(0xa242, 4);
  if (regs.fN) { m.step(0xa2a5, 3); return m.ret(6); }
  m.step(0xa244, 2);
  regs.a = mem.read8(0x05); regs.setNZ(regs.a); m.step(0xa246, 3);
  if (regs.fN) {
    m.step(0xa270, 3);
    regs.a = mem.read8(0x4d); regs.setNZ(regs.a); m.step(0xa272, 3);
    regs.and(0x10); m.step(0xa274, 2);
  } else {
    m.step(0xa248, 2);
    regs.a = mem.read8(0x0106); regs.setNZ(regs.a); m.step(0xa24b, 4);
    mem.write8(0x29, regs.a); m.step(0xa24d, 3);
    regs.x = 0x0a; regs.setNZ(regs.x); m.step(0xa24f, 2);
    do {
      regs.a = mem.read8((0x02db + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xa252, 4);
      if (regs.fZ) {
        m.step(0xa268, 3);
      } else {
        m.step(0xa254, 2);
        regs.a = mem.read8((0x02b5 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xa257, 4);
        regs.sec(); m.step(0xa258, 2);
        regs.sbc(mem.read8(0x0200)); m.step(0xa25b, 4);
        if (!regs.fN) {
          m.step(0xa262, 3);
        } else {
          m.step(0xa25d, 2);
          regs.eor(0xff); m.step(0xa25f, 2);
          regs.clc(); m.step(0xa260, 2);
          regs.adc(0x01); m.step(0xa262, 2);
        }
        regs.cmp(0x02); m.step(0xa264, 2);
        if (regs.fC) {
          m.step(0xa268, 3);
        } else {
          m.step(0xa266, 2);
          mem.write8(0x29, regs.inc8(mem.read8(0x29))); m.step(0xa268, 5);
        }
      }
      regs.x = regs.dec8(regs.x); m.step(0xa269, 2);
      if (!regs.fN) { m.step(0xa24f, 3); continue; }
      m.step(0xa26b, 2); break;
    } while (true);
    regs.a = mem.read8(0x29); regs.setNZ(regs.a); m.step(0xa26d, 3);
    regs.clv(); m.step(0xa26e, 2);
    m.step(0xa274, 3);
  }
  if (regs.fZ) { m.step(0xa2a5, 3); return m.ret(6); }
  m.step(0xa276, 2);
  regs.x = 0x07; regs.setNZ(regs.x); m.step(0xa278, 2);
  do {
    regs.a = mem.read8((0x02d3 + regs.x) & 0xffff); regs.setNZ(regs.a); m.step(0xa27b, 4);
    if (regs.fNZ) {
      m.step(0xa2a2, 3);
    } else {
      m.step(0xa27d, 2);
      mem.write8(0x0135, regs.inc8(mem.read8(0x0135))); m.step(0xa280, 6);
      regs.a = mem.read8(0x0202); regs.setNZ(regs.a); m.step(0xa283, 4);
      mem.write8((0x02d3 + regs.x) & 0xffff, regs.a); m.step(0xa286, 5);
      regs.a = mem.read8(0x0200); regs.setNZ(regs.a); m.step(0xa289, 4);
      mem.write8((0x02ad + regs.x) & 0xffff, regs.a); m.step(0xa28c, 5);
      regs.a = mem.read8(0x0201); regs.setNZ(regs.a); m.step(0xa28f, 4);
      mem.write8((0x02c0 + regs.x) & 0xffff, regs.a); m.step(0xa292, 5);
      regs.a = 0x00; regs.setNZ(regs.a); m.step(0xa294, 2);
      mem.write8((0x02f2 + regs.x) & 0xffff, regs.a); m.step(0xa297, 5);
      m.push16(0xa299); m.step(0xa29a, 6); m.call(0xccea);
      regs.a = mem.read8(0x0202); regs.setNZ(regs.a); m.step(0xa29d, 4);
      m.push16(0xa29f); m.step(0xa2a0, 6); m.call(0xa463);
      regs.x = 0x00; regs.setNZ(regs.x); m.step(0xa2a2, 2);
    }
    regs.x = regs.dec8(regs.x); m.step(0xa2a3, 2);
    if (!regs.fN) { m.step(0xa278, 3); continue; }
    m.step(0xa2a5, 2); break;
  } while (true);
  return m.ret(6);
}
