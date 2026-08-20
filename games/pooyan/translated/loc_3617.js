// SPDX-License-Identifier: GPL-3.0-only

// loc_3617  (ROM 0x3617-0x361c) -- guard: if B>=0x20 return, else tail to loc_365d.
// rst 0x20 dispatch target (word at 0x359c); the ret/tail run in the dispatcher's caller frame.
export function loc_3617(m) {
  const { regs } = m;

  regs.a = regs.b;             m.step(0x3618, 4); // 3617 ld a,b
  regs.cp(0x20);               m.step(0x361a, 7); // 3618 cp 0x20
  if (regs.fNC) { return m.ret(11); }            // 361a ret nc (B>=0x20)
  m.step(0x361b, 5);                             // ret nc not taken
  m.step(0x365d, 12);                            // 361b jr 0x365d (tail)
  return m.call(0x365d);
}
