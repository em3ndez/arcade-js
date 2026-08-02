// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_262f  (ROM 0x262F–0x2676) — sub_25f2's 2nd callee: Y>=0xC0 counts down 0x62A2 (call 0x26de); Y<0xC0 sets 0x62A3=0xFF. Tail: 0x63A5/0x63A4 via 0x26e9, every 32nd frame 0x26a6->0x69ED.
 */
export function loc_262f(m) {
  const { regs, mem } = m;
  regs.hl = 0x62a3;
  m.step(0x2632, 10);
  regs.a = mem.read8(0x6205);
  m.step(0x2635, 13);
  regs.cp(0xc0);
  m.step(0x2637, 7);
  if (regs.fC) { m.step(0x266f, 10); return m.call(0x266f); } // jp c,0x266f
  m.step(0x263a, 10);
  regs.a = mem.read8(0x601a);
  m.step(0x263d, 13);
  regs.rrca();
  m.step(0x263e, 4);
  if (regs.fC) { m.step(0x264c, 10); return m.call(0x264c); } // odd frame
  m.step(0x2641, 10);
  regs.l = (regs.l - 1) & 0xff;
  m.step(0x2642, 4); // -> 0x62A2
  regs.decMem8(mem, regs.hl);
  m.step(0x2643, 11); // dec (0x62A2)
  if (regs.fNZ) { m.step(0x264c, 10); return m.call(0x264c); }
  m.step(0x2646, 10);
  mem.write8(regs.hl, 0xc0);
  m.step(0x2648, 10); // reload
  regs.l = (regs.l + 1) & 0xff;
  m.step(0x2649, 4); // -> 0x62A3
  m.push16(0x264c); m.step(0x26de, 17); m.call(0x26de); // call 0x26de
  return m.call(0x264c);
}
