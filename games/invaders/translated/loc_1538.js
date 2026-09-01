// SPDX-License-Identifier: GPL-3.0-only
// loc_1538  (ROM 0x1538-0x1544) -- prize despawn timer: decrement the counter at 0x2003 and, while
// it is still non-zero, return early. On expiry, reload HL from the stored prize position 0x2064,
// set B=0x10 rows, clear the prize column via loc_1424, then fall through into loc_1545.
export function loc_1538(m) {
  const { regs, mem } = m;

  regs.hl = 0x2003; m.step(0x153b, 10); // 1538  lxi h,0x2003
  regs.decMem8(mem, regs.hl); m.step(0x153c, 10); // 153b  dcr m
  if (regs.fNZ) { return m.ret(11); } m.step(0x153d, 5); // 153c  rnz
  regs.hl = mem.read16(0x2064); m.step(0x1540, 16); // 153d  lhld 0x2064
  regs.b = 0x10; m.step(0x1542, 7); // 1540  mvi b,0x10
  m.push16(0x1545); m.step(0x1424, 17); m.call(0x1424); // 1542  call 0x1424
  return m.call(0x1545); // fall through into loc_1545
}
