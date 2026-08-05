// SPDX-License-Identifier: GPL-3.0-only

// loc_0b39  (ROM 0x0B39–0x0B45)
export function loc_0b39(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xa980);
  m.step(0x0b3c, 13); // ld a,(0xa980)
  regs.bit(0, regs.a); // Z = bit 0 CLEAR
  m.step(0x0b3e, 8); // bit 0,a
  if (regs.fZ) {
    m.step(0x0b46, 12); // jr z,0x0b46 TAKEN -- TAIL jump, nothing pushed
    return m.call(0x0b46);
  }
  m.step(0x0b40, 7); // jr z NOT taken

  regs.de = 0x0100;
  m.step(0x0b43, 10); // ld de,0x0100
  m.step(0x0038, 10); // jp 0x0038 -- TAIL jump, nothing pushed
  return m.call(0x0038);
}
