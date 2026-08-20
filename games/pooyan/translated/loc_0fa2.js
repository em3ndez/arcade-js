// SPDX-License-Identifier: GPL-3.0-only

// loc_0fa2  (ROM 0x0fa2-0x0fac) -- select one of four tile codes 0x22..0x25 from (0x8907)
// (rrca, low 2 bits, + 0x22) and tail-jp into the 4-tile emitter 0x0fc3.
export function loc_0fa2(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8907);   m.step(0x0fa5, 13);
  regs.rrca();                  m.step(0x0fa6, 4);
  regs.and(0x03);               m.step(0x0fa8, 7);
  regs.add(0x22);               m.step(0x0faa, 7);
  m.step(0x0fc3, 10);           // 0faa  jp 0x0fc3 -- tail into loc_0fc3
  return m.call(0x0fc3);
}
