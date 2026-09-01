// SPDX-License-Identifier: GPL-3.0-only
// loc_1400  (ROM 0x1400-0x1421) -- jmp target from 0x03f7/0x0407; calls 0x1474 then over B passes
// shift-blits [DE] across [HL] and [HL+1] via OUT 0x04 / IN 0x03, HL += 0x20 per pass (loop top 0x1405).
export function loc_1400(m) {
  const { regs, mem } = m;

  m.step(0x1401, 4); // 1400  nop
  m.push16(0x1404); m.step(0x1474, 17); m.call(0x1474); // 1401  call 0x1474
  m.step(0x1405, 4);

  for (;;) {
    m.push16(regs.bc); m.step(0x1406, 11); // 1405  push b
    m.push16(regs.hl); m.step(0x1407, 11); // 1406  push h
    regs.a = mem.read8(regs.de); m.step(0x1408, 7); // 1407  ldax d
    m.io.portOut(0x04, regs.a); m.step(0x140a, 10); // 1408  out 0x04
    regs.a = m.io.portIn(0x03); m.step(0x140c, 10); // 140a  in 0x03
    regs.or(mem.read8(regs.hl)); m.step(0x140d, 7); // 140c  ora m
    mem.write8(regs.hl, regs.a); m.step(0x140e, 7); // 140d  mov m,a
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x140f, 5);
    regs.de = (regs.de + 1) & 0xffff; m.step(0x1410, 5);
    regs.xor(regs.a); m.step(0x1411, 4); // 1410  xra a (2nd dest byte)
    m.io.portOut(0x04, regs.a); m.step(0x1413, 10); // 1411  out 0x04
    regs.a = m.io.portIn(0x03); m.step(0x1415, 10); // 1413  in 0x03
    regs.or(mem.read8(regs.hl)); m.step(0x1416, 7); // 1415  ora m
    mem.write8(regs.hl, regs.a); m.step(0x1417, 7); // 1416  mov m,a
    regs.hl = m.pop16(); m.step(0x1418, 10); // 1417  pop h
    regs.bc = 0x0020; m.step(0x141b, 10); // 1418  lxi b,0x0020
    regs.addHl(regs.bc); m.step(0x141c, 10); // 141b  dad b
    regs.bc = m.pop16(); m.step(0x141d, 10); // 141c  pop b
    regs.b = regs.dec8(regs.b); m.step(0x141e, 5); // 141d  dcr b
    if (regs.fNZ) { m.step(0x1405, 10); continue; } // 141e  jnz 0x1405
    m.step(0x1421, 10);
    break;
  }
  return m.ret(10); // 1421  ret
}
