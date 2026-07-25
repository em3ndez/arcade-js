// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_2745  (ROM 0x2745–0x2796) — player-position state machine on (0x6203): band-dispatch to reset/down/up arms.
 */
export function sub_2745(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x6398);
  m.step(0x2748, 13);
  regs.and(regs.a);
  m.step(0x2749, 4);
  if (regs.fZ) { m.ret(11); return; } // ret z inactive
  m.step(0x274a, 5);
  regs.a = mem.read8(0x6216);
  m.step(0x274d, 13);
  regs.and(regs.a);
  m.step(0x274e, 4);
  if (regs.fNZ) { m.ret(11); return; } // ret nz busy
  m.step(0x274f, 5);
  regs.a = mem.read8(0x6203);
  m.step(0x2752, 13);
  regs.cp(0x2c);
  m.step(0x2754, 7);
  if (regs.fC) { m.step(0x2766, 10); return m.call(0x2766); }
  m.step(0x2757, 10);
  regs.cp(0x43);
  m.step(0x2759, 7);
  if (regs.fC) { m.step(0x276f, 10); return m.call(0x276f); }
  m.step(0x275c, 10);
  regs.cp(0x6c);
  m.step(0x275e, 7);
  if (regs.fC) { m.step(0x2766, 10); return m.call(0x2766); }
  m.step(0x2761, 10);
  regs.cp(0x83);
  m.step(0x2763, 7);
  if (regs.fC) { m.step(0x2787, 10); return m.call(0x2787); }
  m.step(0x2766, 10);
  return m.call(0x2766);
}
