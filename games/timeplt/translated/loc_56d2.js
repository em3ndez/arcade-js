// SPDX-License-Identifier: GPL-3.0-only

// loc_56d2  (ROM 0x56d2-0x56e3, Time Pilot)
export function loc_56d2(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x0c5b); // ROM
  m.step(0x56d5, 13); // 56d2  ld a,(0x0c5b)
  m.push16(0x56d8);
  m.step(0x560c, 17); // 56d5  call 0x560c
  m.call(0x560c);

  regs.a = mem.read8(0x0855); // ROM
  m.step(0x56db, 13); // 56d8  ld a,(0x0855)
  m.push16(0x56de);
  m.step(0x560c, 17); // 56db  call 0x560c
  m.call(0x560c);

  regs.a = mem.read8(0x1675); // ROM
  m.step(0x56e1, 13); // 56de  ld a,(0x1675)
  m.push16(0x56e4);
  m.step(0x560c, 17); // 56e1  call 0x560c
  m.call(0x560c);

  return m.call(0x56e4);
}
