// SPDX-License-Identifier: GPL-3.0-only

// loc_0b46  (ROM 0x0B46-0x0B4B)
export function loc_0b46(m) {
  const { regs } = m;

  regs.de = 0x011f;
  m.step(0x0b49, 10); // ld de,0x011f

  m.step(0x0038, 10); // jp 0x0038 -- TAIL jump, nothing pushed
  return m.call(0x0038);
}
