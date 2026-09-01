// SPDX-License-Identifier: GPL-3.0-only
// loc_1424  (ROM 0x1424-0x1438) -- clear a vertical tile column: call 0x1474 (shift-reg select
// / tail into 0x1a47), then over B rows zero two adjacent tiles at HL and advance HL by 0x20
// (one screen row) each pass. Loop top 0x1427 is interior.
export function loc_1424(m) {
  const { regs, mem } = m;

  m.push16(0x1427); m.step(0x1474, 17); m.call(0x1474); // 1424  call 0x1474
  for (;;) {
    m.push16(regs.bc); m.step(0x1428, 11); // 1427  push b
    m.push16(regs.hl); m.step(0x1429, 11); // 1428  push h
    regs.xor(regs.a); m.step(0x142a, 4); // 1429  xra a
    mem.write8(regs.hl, regs.a); m.step(0x142b, 7); // 142a  mov m,a
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x142c, 5); // 142b  inx h
    mem.write8(regs.hl, regs.a); m.step(0x142d, 7); // 142c  mov m,a
    regs.hl = (regs.hl + 1) & 0xffff; m.step(0x142e, 5); // 142d  inx h
    regs.hl = m.pop16(); m.step(0x142f, 10); // 142e  pop h
    regs.bc = 0x0020; m.step(0x1432, 10); // 142f  lxi b,0x0020
    regs.addHl(regs.bc); m.step(0x1433, 10); // 1432  dad b
    regs.bc = m.pop16(); m.step(0x1434, 10); // 1433  pop b
    regs.b = regs.dec8(regs.b); m.step(0x1435, 5); // 1434  dcr b
    if (regs.fNZ) { m.step(0x1427, 10); continue; } // 1435  jnz 0x1427
    m.step(0x1438, 10);
    break;
  }
  return m.ret(10); // 1438  ret
}
