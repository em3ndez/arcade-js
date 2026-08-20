// SPDX-License-Identifier: GPL-3.0-only

// loc_0f76  (ROM 0x0f76-0x0f87) -- when gate 0x8d68 is clear, draw tile 0x1a+(0x8907 bit0) via
// loc_0ea2 and tail-jp to loc_0fc3; otherwise return immediately.
export function loc_0f76(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8d68);  m.step(0x0f79, 13);
  regs.or(regs.a);             m.step(0x0f7a, 4);
  if (regs.fNZ) { m.ret(11); return; }
  m.step(0x0f7b, 5);
  regs.a = mem.read8(0x8907);  m.step(0x0f7e, 13);
  regs.and(0x01);              m.step(0x0f80, 7);
  regs.add(0x1a);              m.step(0x0f82, 7);
  m.push16(0x0f85);
  m.step(0x0ea2, 17);          // call 0x0ea2 (boundary)
  m.call(0x0ea2);
  m.step(0x0fc3, 10);          // jp 0x0fc3 (tail, boundary)
  return m.call(0x0fc3);
}
