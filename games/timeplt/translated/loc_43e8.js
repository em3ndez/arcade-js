// SPDX-License-Identifier: GPL-3.0-only

// loc_43e8  (ROM 0x43E8-0x43EF, Time Pilot)
export function loc_43e8(m) {
  const { regs, mem } = m;

  regs.xor(regs.a);
  m.step(0x43e9, 4); // xor a

  do {
    regs.add(mem.read8(regs.hl));
    m.step(0x43ea, 7); // add a,(hl)
    regs.hl = (regs.hl + 1) & 0xffff; // 16-bit INC: no flags
    m.step(0x43eb, 6); // inc hl
    regs.djnz(); // djnz -- no flags
    m.step(regs.b !== 0 ? 0x43e9 : 0x43ed, regs.b !== 0 ? 13 : 8); // djnz 0x43e9
  } while (regs.b !== 0);

  m.step(0x07ad, 10); // jp 0x07ad -- TAIL, nothing pushed
  return m.call(0x07ad);
}
