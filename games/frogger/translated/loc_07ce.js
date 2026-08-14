// SPDX-License-Identifier: GPL-3.0-only

// loc_07ce  (ROM 0x07CE-0x07D8) — 2-player start-flag helper: if (0x826d)==0 return, else set the
// start flag (0x825b)=1. Leaf; reached from loc_07c1's jp z.
export function loc_07ce(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x826d);
  m.step(0x07d1, 13);
  regs.and(regs.a);
  m.step(0x07d2, 4);
  if (regs.fZ) {
    m.ret(11); // ret z (taken) -- (0x826d) == 0, leave the flag alone
    return;
  }
  m.step(0x07d3, 5);

  regs.a = 0x01;
  m.step(0x07d5, 7);
  mem.write8(0x825b, regs.a);
  m.step(0x07d8, 13); // (0x825b) = 1

  m.ret();
}
