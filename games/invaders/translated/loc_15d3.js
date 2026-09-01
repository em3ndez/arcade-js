// SPDX-License-Identifier: GPL-3.0-only
// loc_15d3  (ROM 0x15d3-0x15f2) -- shift-register-decode B rows from (DE) into (HL)/(HL+1) via ports 0x04/0x03, stepping HL by 0x20 per row.
export function loc_15d3(m) {
  const { regs, mem, io } = m;

  m.push16(0x15d6); m.step(0x1474, 17); m.call(0x1474);
  m.push16(regs.hl); m.step(0x15d7, 11); // 15d6  push h

  for (;;) {
    m.push16(regs.bc); m.step(0x15d8, 11); // 15d7  push b
    m.push16(regs.hl); m.step(0x15d9, 11); // 15d8  push h
    regs.a = mem.read8(regs.de); m.step(0x15da, 7); // 15d9  ldax d
    io.portOut(0x04, regs.a); m.step(0x15dc, 10); // 15da  out 0x04
    regs.a = io.portIn(0x03); m.step(0x15de, 10); // 15dc  in 0x03
    mem.write8(regs.hl, regs.a); m.step(0x15df, 7); // 15de  mov m,a
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x15e0, 5); // 15df  inx h
    regs.de = (regs.de + 1) & 0xffff; m.step(0x15e1, 5); // 15e0  inx d
    regs.xor(regs.a); m.step(0x15e2, 4); // 15e1  xra a
    io.portOut(0x04, regs.a); m.step(0x15e4, 10); // 15e2  out 0x04
    regs.a = io.portIn(0x03); m.step(0x15e6, 10); // 15e4  in 0x03
    mem.write8(regs.hl, regs.a); m.step(0x15e7, 7); // 15e6  mov m,a
    regs.hl = m.pop16(); m.step(0x15e8, 10); // 15e7  pop h
    regs.bc = 0x0020; m.step(0x15eb, 10); // 15e8  lxi b,0x0020
    regs.addHl(regs.bc); m.step(0x15ec, 10); // 15eb  dad b
    regs.bc = m.pop16(); m.step(0x15ed, 10); // 15ec  pop b
    regs.b = regs.dec8(regs.b); m.step(0x15ee, 5); // 15ed  dcr b
    if (regs.fNZ) { m.step(0x15d7, 10); continue; }
    m.step(0x15f1, 10); break;
  }

  regs.hl = m.pop16(); m.step(0x15f2, 10); // 15f1  pop h
  return m.ret(10);
}
