// SPDX-License-Identifier: GPL-3.0-only

// loc_0b4c  (ROM 0x0B4C–0x0B53)
export function loc_0b4c(m) {
  const { regs, mem } = m;

  regs.xor(regs.a); // A = 0
  m.step(0x0b4d, 4); // xor a

  do {
    regs.add(mem.read8(regs.hl));
    m.step(0x0b4e, 7); // add a,(hl)
    regs.hl = (regs.hl + 1) & 0xffff; // inc hl -- 16-bit, no flags
    m.step(0x0b4f, 6); // inc hl
    regs.djnz();
    m.step(regs.b !== 0 ? 0x0b4d : 0x0b51, regs.b !== 0 ? 13 : 8); // djnz 0x0b4d
  } while (regs.b !== 0);

  regs.cp(regs.c);
  m.step(0x0b52, 4); // cp c

  if (regs.fZ) {
    m.ret(11); // 0x0b52 ret z -- taken
    return;
  }
  m.step(0x0b53, 5); // ret z not taken
  m.ret(); // 0x0b53
}
