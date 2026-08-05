// SPDX-License-Identifier: GPL-3.0-only

// loc_1690  (ROM 0x1690-0x16AE and 0x1719-0x1729)
export function loc_1690(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xa9ae);
  m.step(0x1693, 13); // 1690  ld a,(0xa9ae)
  regs.bit(4, regs.a); // Z = bit 4 CLEAR
  m.step(0x1695, 8); // 1693  bit 4,a

  if (regs.fNZ) {
    m.step(0x169c, 12); // 1695  jr nz,0x169c (taken)

    regs.a = 0xff;
    m.step(0x169e, 7); // 169c  ld a,0xff
    mem.write8(0xad30, regs.a);
    m.step(0x16a1, 13); // 169e  ld (0xad30),a
    mem.write8(0xad31, regs.a);
    m.step(0x16a4, 13); // 16a1  ld (0xad31),a
    regs.a = mem.read8(0xa9c1);
    m.step(0x16a7, 13); // 16a4  ld a,(0xa9c1)
    mem.write8(0xad10, regs.a);
    m.step(0x16aa, 13); // 16a7  ld (0xad10),a
    mem.write8(0xad20, regs.a);
    m.step(0x16ad, 13); // 16aa  ld (0xad20),a

    m.step(0x172a, 12); // 16ad  jr 0x172a -- TAIL transfer over loc_16af
    return m.call(0x172a);
  }
  m.step(0x1697, 7); // 1695  jr nz,0x169c (not taken)

  regs.bit(3, regs.a); // Z = bit 3 CLEAR
  m.step(0x1699, 8); // 1697  bit 3,a

  if (regs.fZ) {
    m.step(0x169b, 7); // 1699  jr nz,0x1719 (not taken)
    m.ret(10); // 169b  ret -- neither bit set
    return;
  }
  m.step(0x1719, 12); // 1699  jr nz,0x1719 (taken)

  regs.xor(regs.a);
  m.step(0x171a, 4); // 1719  xor a
  mem.write8(0xad31, regs.a);
  m.step(0x171d, 13); // 171a  ld (0xad31),a
  mem.write8(0xad20, regs.a);
  m.step(0x1720, 13); // 171d  ld (0xad20),a
  regs.a = regs.dec8(regs.a);
  m.step(0x1721, 4); // 1720  dec a -- 0x00 - 1 = 0xFF
  mem.write8(0xad30, regs.a);
  m.step(0x1724, 13); // 1721  ld (0xad30),a
  regs.a = mem.read8(0xa9c1);
  m.step(0x1727, 13); // 1724  ld a,(0xa9c1)
  mem.write8(0xad10, regs.a);
  m.step(0x172a, 13); // 1727  ld (0xad10),a

  return m.call(0x172a);
}
