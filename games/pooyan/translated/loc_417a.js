// SPDX-License-Identifier: GPL-3.0-only

// loc_417a  (ROM 0x417a-0x418c) -- (re)arms an object: passes (ix+0x17) to loc_0c45 with the
// 0x41b1 data pointer, runs loc_381e, seats the (ix+0x11) countdown to 0x30 and bumps the
// (ix+0x02) state, then FALLS THROUGH into loc_418d (its shared tail, also a direct entry).
export function loc_417a(m) {
  const { regs, mem } = m;

  regs.a = mem.read8((regs.ix + 0x17) & 0xffff); m.step(0x417d, 19); // 417a  ld a,(ix+0x17)
  regs.hl = 0x41b1;                              m.step(0x4180, 10); // 417d  ld hl,0x41b1

  m.push16(0x4183);
  m.step(0x0c45, 17); // 4180  call 0x0c45 (pattern A)
  m.call(0x0c45);

  m.push16(0x4186);
  m.step(0x381e, 17); // 4183  call 0x381e (pattern A)
  m.call(0x381e);

  mem.write8((regs.ix + 0x11) & 0xffff, 0x30);   m.step(0x418a, 19); // 4186  ld (ix+0x11),0x30
  regs.incMem8(mem, (regs.ix + 0x02) & 0xffff);  m.step(0x418d, 23); // 418a  inc (ix+0x02)

  return m.call(0x418d); // fall through into loc_418d (shared tail, caller frame reused)
}
