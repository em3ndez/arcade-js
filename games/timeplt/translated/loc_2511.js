// SPDX-License-Identifier: GPL-3.0-only

// loc_2511  (ROM 0x2511-0x252F, Time Pilot)
export function loc_2511(m) {
  const { regs, mem } = m;

  regs.hl = 0xac00;
  m.step(0x2514, 10); // ld hl,0xac00
  regs.b = 0x40;
  m.step(0x2516, 7); // ld b,0x40

  do {
    mem.write8(regs.hl, 0xff);
    m.step(0x2518, 10); // ld (hl),0xff
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x2519, 6); // inc hl
    regs.djnz(); // affects NO flags
    m.step(regs.b !== 0 ? 0x2516 : 0x251b, regs.b !== 0 ? 13 : 8); // djnz 0x2516
  } while (regs.b !== 0);

  m.push16(0x251e);
  m.step(0x4b67, 17); // call 0x4b67
  m.call(0x4b67);
  mem.write8(0xc200, regs.a, 10);
  m.step(0x2521, 13); // ld (0xc200),a -- watchdog

  m.push16(0x2524);
  m.step(0x4ba5, 17); // call 0x4ba5
  m.call(0x4ba5);
  mem.write8(0xc200, regs.a, 10);
  m.step(0x2527, 13); // ld (0xc200),a -- watchdog

  m.push16(0x252a);
  m.step(0x526a, 17); // call 0x526a
  m.call(0x526a);
  mem.write8(0xc200, regs.a, 10);
  m.step(0x252d, 13); // ld (0xc200),a -- watchdog

  m.step(0x52aa, 10); // jp 0x52aa -- TAIL jump, nothing pushed
  return m.call(0x52aa);
}
