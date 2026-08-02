// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_26de  (ROM 0x26DE–0x26E8) — sign-REVERSING write: (HL)=+2 if bit7 set, else -2. HL live-in.
 */
export function loc_26de(m) {
  const { regs, mem } = m;
  const set = regs.bit(7, mem.read8(regs.hl));
  m.step(0x26e0, 12); // bit 7,(hl)
  if (!set) {
    m.step(0x26e6, 10); // jp z,0x26e6
    mem.write8(regs.hl, 0xfe); // -2
    m.step(0x26e8, 10);
    m.ret();
    return;
  }
  m.step(0x26e3, 10);
  mem.write8(regs.hl, 0x02); // +2
  m.step(0x26e5, 10);
  m.ret();
}
