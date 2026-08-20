// SPDX-License-Identifier: GPL-3.0-only

// loc_5564  (ROM 0x5564-0x5592) -- frame-timer gated spawner. Decrements the timer at 0x8d06 and rets
// while it is running (ret nz). On expiry it reloads the timer from table 0x560f indexed by (0x8d14 &
// 0x0f) via rst 0x20 (loc_0020), advances the phase index 0x8d14, and points IX at the block table
// 0x8c60 (stride 0x18). The spawn count B is chosen from thresholds: (0x8907) >= 4 -> B=2; else if the
// active-wave count (0x8820) is zero it bails (ret z), (0x8820) < 4 -> B=1, else B=2. Falls through
// into loc_5594 (tail), which runs the scan/seed loop with that B.
export function loc_5564(m) {
  const { regs, mem } = m;

  regs.hl = 0x8d06;                     m.step(0x5567, 10);
  regs.decMem8(mem, regs.hl);           m.step(0x5568, 11);
  if (regs.fNZ) { m.ret(11); return; }  // 5568 ret nz -- timer still running
  m.step(0x5569, 5);
  regs.hl = 0x560f;                     m.step(0x556c, 10);
  regs.a = mem.read8(0x8d14);           m.step(0x556f, 13);
  regs.and(0x0f);                       m.step(0x5571, 7);
  m.push16(0x5572); m.step(0x0020, 11); m.call(0x0020); // rst 0x20 (loc_0020: A = mem[0x560f+idx])
  mem.write8(0x8d06, regs.a);           m.step(0x5575, 13); // reload timer
  regs.hl = 0x8d14;                     m.step(0x5578, 10);
  regs.incMem8(mem, regs.hl);           m.step(0x5579, 11); // advance phase index
  regs.ix = 0x8c60;                     m.step(0x557d, 14);
  regs.de = 0x0018;                     m.step(0x5580, 10);
  regs.a = mem.read8(0x8907);           m.step(0x5583, 13);
  regs.cp(0x04);                        m.step(0x5585, 7);
  if (regs.fNC) {
    m.step(0x5592, 12);                 // 5585 jr nc taken -- (0x8907) >= 4
    regs.b = 0x02;                      m.step(0x5594, 7);
    return m.call(0x5594);             // fall through into loc_5594 (tail: its ret returns to our caller)
  }
  m.step(0x5587, 7);
  regs.a = mem.read8(0x8820);           m.step(0x558a, 13);
  regs.and(regs.a);                     m.step(0x558b, 4);
  if (regs.fZ) { m.ret(11); return; }   // 558b ret z -- no active wave
  m.step(0x558c, 5);
  regs.cp(0x04);                        m.step(0x558e, 7);
  regs.b = 0x01;                        m.step(0x5590, 7);
  if (regs.fC) {
    m.step(0x5594, 12);                 // 5590 jr c taken -- (0x8820) < 4, B=1
    return m.call(0x5594);             // tail
  }
  m.step(0x5592, 7);
  regs.b = 0x02;                        m.step(0x5594, 7);
  return m.call(0x5594);               // fall through into loc_5594 (tail), B=2
}
