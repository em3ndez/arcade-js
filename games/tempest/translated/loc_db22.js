// SPDX-License-Identifier: GPL-3.0-only
// loc_db22  (ROM 0xdb22-0xdb59) -- clears a bank of $60xx EAROM/POKEY-ish regs, dummy-reads four, then a
// rol-walked bit marches a 1 across $6080..$609f (bpl loop), and tail-jumps to loc_df39.
export function loc_db22(m) {
  const { regs, mem } = m;
  regs.a = 0x00; regs.setNZ(regs.a); m.step(0xdb24, 2);
  mem.write8(0x60e0, regs.a); m.step(0xdb27, 4);
  mem.write8(0x6080, regs.a); m.step(0xdb2a, 4);
  mem.write8(0x60c0, regs.a); m.step(0xdb2d, 4);
  mem.write8(0x60d0, regs.a); m.step(0xdb30, 4);
  mem.write8(0x6000, regs.a); m.step(0xdb33, 4);
  mem.write8(0x6040, regs.a); m.step(0xdb36, 4);
  regs.a = mem.read8(0x6040); regs.setNZ(regs.a); m.step(0xdb39, 4);
  regs.a = mem.read8(0x6060); regs.setNZ(regs.a); m.step(0xdb3c, 4);
  regs.a = mem.read8(0x6070); regs.setNZ(regs.a); m.step(0xdb3f, 4);
  regs.a = mem.read8(0x6050); regs.setNZ(regs.a); m.step(0xdb42, 4);
  regs.a = 0x08; regs.setNZ(regs.a); m.step(0xdb44, 2);
  mem.write8(0x60e0, regs.a); m.step(0xdb47, 4);
  regs.a = 0x01; regs.setNZ(regs.a); m.step(0xdb49, 2);
  regs.x = 0x1f; regs.setNZ(regs.x); m.step(0xdb4b, 2);
  regs.clc(); m.step(0xdb4c, 2);
  for (;;) {
    mem.write8((0x6080 + regs.x) & 0xffff, regs.a); m.step(0xdb4f, 5);
    regs.a = regs.rol(regs.a); m.step(0xdb50, 2);
    regs.x = regs.dec8(regs.x); m.step(0xdb51, 2);
    if (regs.fPl) { m.step(0xdb4c, 3); continue; }
    m.step(0xdb53, 2); break;
  }
  regs.a = 0x34; regs.setNZ(regs.a); m.step(0xdb55, 2);
  regs.x = 0xa6; regs.setNZ(regs.x); m.step(0xdb57, 2);
  m.step(0xdf39, 3); return m.call(0xdf39);
}
