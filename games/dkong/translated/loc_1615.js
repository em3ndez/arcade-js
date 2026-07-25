// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1615  (ROM 0x1615–0x1653) — L2 board-advance dispatcher (game sub-state 0x600A=0x16).
 * call 0x30bd; then by (0x6227) bit0/bit1, rst-0x28-dispatch (0x6388) via table @0x1623
 * ([1654,1670,168a,1732,1757,178e]) or @0x1637 ([16a3,16bb,1732,1757,178e]); else fall into
 * sub_1641 (call 0x1dbd + rst 0x28 @0x1648). All rst-0x28 tails route through dispatchGameState.
 */
export function loc_1615(m) {
  const { regs, mem } = m;
  m.push16(0x1618); m.step(0x30bd, 17); m.call(0x30bd); // call 0x30bd
  regs.a = mem.read8(0x6227);
  m.step(0x161b, 13); // ld a,(0x6227)
  regs.rrca();
  m.step(0x161c, 4); // rrca -- bit0
  if (regs.fC) {
    m.step(0x161f, 10);
    regs.a = mem.read8(0x6388);
    m.step(0x1622, 13); // ld a,(0x6388)
    m.push16(0x1623); m.step(0x0028, 11); // rst 0x28 (table @0x1623)
    return m.call(0x0028, "0x1623 (0x6388 board sub-dispatch)");
  }
  m.step(0x162f, 10); // jp nc,0x162f
  regs.rrca();
  m.step(0x1630, 4); // rrca -- bit1
  if (regs.fC) {
    m.step(0x1633, 10);
    regs.a = mem.read8(0x6388);
    m.step(0x1636, 13); // ld a,(0x6388)
    m.push16(0x1637); m.step(0x0028, 11); // rst 0x28 (table @0x1637)
    return m.call(0x0028, "0x1637 (0x6388 board sub-dispatch)");
  }
  m.step(0x1641, 10); // jp nc,0x1641 -> sub_1641 (call 0x1dbd + rst 0x28 @0x1648)
  return m.call(0x1641);
}
