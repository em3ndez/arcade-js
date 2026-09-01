// SPDX-License-Identifier: GPL-3.0-only
// loc_1452 (ROM 0x1452-0x1473) -- ERASE B rows of a sprite. Call 0x1474 to seat the shift offset,
// then per row AND the complement of the shifted byte (ports 0x04/0x03) into (HL)/(HL+1); HL += 0x20.
export function loc_1452(m) {
  const { regs, mem, io } = m;

  m.push16(0x1455); m.step(0x1474, 17); m.call(0x1474); // 1452  call 0x1474

  for (;;) { // 1455  row loop (B counter)
    m.push16(regs.bc); m.step(0x1456, 11);
    m.push16(regs.hl); m.step(0x1457, 11);
    regs.a = mem.read8(regs.de); m.step(0x1458, 7); // 1457  ldax d
    io.portOut(0x04, regs.a); m.step(0x145a, 10); // 1458  out 0x04
    regs.a = io.portIn(0x03); m.step(0x145c, 10); // 145a  in 0x03
    regs.cpl(); m.step(0x145d, 4); // 145c  cma
    regs.and(mem.read8(regs.hl)); m.step(0x145e, 7); // 145d  ana m
    mem.write8(regs.hl, regs.a); m.step(0x145f, 7); // 145e  mov m,a
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x1460, 5); // 145f  inx h
    regs.de = (regs.de + 1) & 0xffff; m.step(0x1461, 5); // 1460  inx d
    regs.xor(regs.a); m.step(0x1462, 4); // 1461  xra a
    io.portOut(0x04, regs.a); m.step(0x1464, 10); // 1462  out 0x04
    regs.a = io.portIn(0x03); m.step(0x1466, 10); // 1464  in 0x03
    regs.cpl(); m.step(0x1467, 4); // 1466  cma
    regs.and(mem.read8(regs.hl)); m.step(0x1468, 7); // 1467  ana m
    mem.write8(regs.hl, regs.a); m.step(0x1469, 7); // 1468  mov m,a
    regs.hl = m.pop16(); m.step(0x146a, 10);
    regs.bc = 0x0020; m.step(0x146d, 10); // 146a  lxi b,0x0020
    regs.addHl(regs.bc); m.step(0x146e, 10); // 146d  dad b
    regs.bc = m.pop16(); m.step(0x146f, 10);
    regs.b = regs.dec8(regs.b); m.step(0x1470, 5); // 146f  dcr b
    if (regs.fNZ) { m.step(0x1455, 10); continue; }
    m.step(0x1473, 10);
    break;
  }
  return m.ret(10);
}
