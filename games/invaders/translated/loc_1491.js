// SPDX-License-Identifier: GPL-3.0-only
// loc_1491 (ROM 0x1491-0x14ca) -- DRAW B rows with collision detect. Call 0x1474, clear flag 0x2061,
// then per row/column AND the shifted byte (ports 0x04/0x03) with (HL) (overlap sets 0x2061), then OR it in.
export function loc_1491(m) {
  const { regs, mem, io } = m;

  m.push16(0x1494); m.step(0x1474, 17); m.call(0x1474); // 1491  call 0x1474
  regs.xor(regs.a); m.step(0x1495, 4); // 1494  xra a
  mem.write8(0x2061, regs.a); m.step(0x1498, 13); // 1495  sta 0x2061

  for (;;) { // 1498  row loop (B counter)
    m.push16(regs.bc); m.step(0x1499, 11); // 1498  push b
    m.push16(regs.hl); m.step(0x149a, 11); // 1499  push h

    regs.a = mem.read8(regs.de); m.step(0x149b, 7); // 149a  ldax d
    io.portOut(0x04, regs.a); m.step(0x149d, 10); // 149b  out 0x04
    regs.a = io.portIn(0x03); m.step(0x149f, 10); // 149d  in 0x03
    m.push16(regs.af); m.step(0x14a0, 11);
    regs.and(mem.read8(regs.hl)); m.step(0x14a1, 7); // 14a0  ana m
    if (regs.fZ) {
      m.step(0x14a9, 10);
    } else {
      m.step(0x14a4, 10);
      regs.a = 0x01; m.step(0x14a6, 7); // 14a4  mvi a,0x01
      mem.write8(0x2061, regs.a); m.step(0x14a9, 13); // 14a6  sta 0x2061
    }
    regs.af = m.pop16(); m.step(0x14aa, 10);
    regs.or(mem.read8(regs.hl)); m.step(0x14ab, 7); // 14aa  ora m
    mem.write8(regs.hl, regs.a); m.step(0x14ac, 7); // 14ab  mov m,a
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x14ad, 5); // 14ac  inx h
    regs.de = (regs.de + 1) & 0xffff; m.step(0x14ae, 5); // 14ad  inx d

    regs.xor(regs.a); m.step(0x14af, 4); // 14ae  xra a
    io.portOut(0x04, regs.a); m.step(0x14b1, 10); // 14af  out 0x04
    regs.a = io.portIn(0x03); m.step(0x14b3, 10); // 14b1  in 0x03
    m.push16(regs.af); m.step(0x14b4, 11);
    regs.and(mem.read8(regs.hl)); m.step(0x14b5, 7); // 14b4  ana m
    if (regs.fZ) {
      m.step(0x14bd, 10);
    } else {
      m.step(0x14b8, 10);
      regs.a = 0x01; m.step(0x14ba, 7); // 14b8  mvi a,0x01
      mem.write8(0x2061, regs.a); m.step(0x14bd, 13); // 14ba  sta 0x2061
    }
    regs.af = m.pop16(); m.step(0x14be, 10);
    regs.or(mem.read8(regs.hl)); m.step(0x14bf, 7); // 14be  ora m
    mem.write8(regs.hl, regs.a); m.step(0x14c0, 7); // 14bf  mov m,a

    regs.hl = m.pop16(); m.step(0x14c1, 10); // 14c0  pop h
    regs.bc = 0x0020; m.step(0x14c4, 10); // 14c1  lxi b,0x0020
    regs.addHl(regs.bc); m.step(0x14c5, 10); // 14c4  dad b
    regs.bc = m.pop16(); m.step(0x14c6, 10); // 14c5  pop b
    regs.b = regs.dec8(regs.b); m.step(0x14c7, 5); // 14c6  dcr b
    if (regs.fNZ) { m.step(0x1498, 10); continue; }
    m.step(0x14ca, 10);
    break;
  }
  return m.ret(10);
}
