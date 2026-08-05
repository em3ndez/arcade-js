// SPDX-License-Identifier: GPL-3.0-only

// loc_00a8  (ROM 0x00A8-0x00B0, Time Pilot)
export function loc_00a8(m) {
  const { regs, mem } = m;

  mem.write8(0xc300, regs.a, 10);
  m.step(0x00ab, 13); // ld (0xc300),a -- LS259 offset 0

  mem.write8(0xc200, regs.a, 10);
  m.step(0x00ae, 13); // ld (0xc200),a -- watchdog kick, value ignored

  m.step(0x0b93, 10); // jp 0x0b93
  return m.call(0x0b93);
}
