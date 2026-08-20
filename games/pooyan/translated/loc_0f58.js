// SPDX-License-Identifier: GPL-3.0-only

// loc_0f58  (ROM 0x0f58-0x0f6b) -- queue four HUD/tile draws: loc_0ea2 with A=0x96 then 0x97,
// loc_0eb3 with A=0x18, then a tail jp to loc_0eb3 with A=0x15. Straight-line, no branches.
export function loc_0f58(m) {
  const { regs } = m;

  regs.a = 0x96;      m.step(0x0f5a, 7);
  m.push16(0x0f5d);
  m.step(0x0ea2, 17); // call 0x0ea2 (boundary)
  m.call(0x0ea2);
  regs.a = 0x97;      m.step(0x0f5f, 7);
  m.push16(0x0f62);
  m.step(0x0ea2, 17); // call 0x0ea2 (boundary)
  m.call(0x0ea2);
  regs.a = 0x18;      m.step(0x0f64, 7);
  m.push16(0x0f67);
  m.step(0x0eb3, 17); // call 0x0eb3
  m.call(0x0eb3);
  regs.a = 0x15;      m.step(0x0f69, 7);
  m.step(0x0eb3, 10); // jp 0x0eb3 (tail)
  return m.call(0x0eb3);
}
