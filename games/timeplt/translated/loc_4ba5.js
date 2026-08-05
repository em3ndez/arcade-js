// SPDX-License-Identifier: GPL-3.0-only

// loc_4ba5  (ROM 0x4BA5-0x4BB0, Time Pilot)
export function loc_4ba5(m) {
  const { regs } = m;

  regs.hl = 0x4bb1;
  m.step(0x4ba8, 10); // ld hl,0x4bb1 -- the table right after the ret

  regs.de = 0xab08;
  m.step(0x4bab, 10); // ld de,0xab08

  regs.bc = 0x0028;
  m.step(0x4bae, 10); // ld bc,0x0028

  m.ldirAt(0x4bae, 0x4bb0); // ldir -- 0x28 bytes

  m.ret(); // 4bb0  ret
}
