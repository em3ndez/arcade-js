// SPDX-License-Identifier: GPL-3.0-only

// loc_0e54  (ROM 0x0e54-0x0e63) -- queue one fixed display-list entry (0x0701) via rst 0x38,
// then a second (0x0606) only when the counter at (0x882c) has reached 0x0f.
export function loc_0e54(m) {
  const { regs, mem } = m;

  regs.de = 0x0701;
  m.step(0x0e57, 10);
  m.push16(0x0e58);
  m.step(0x0038, 11); // 0e57  rst 0x38 -- append DE to the display list
  m.call(0x0038);
  regs.a = mem.read8(0x882c);
  m.step(0x0e5b, 13); // 0e58  ld a,(0x882c)
  regs.cp(0x0f);
  m.step(0x0e5d, 7);
  if (regs.fNZ) {
    m.step(0x0e63, 12); // 0e5d  jr nz,0x0e63 (skip second entry)
  } else {
    m.step(0x0e5f, 7);
    regs.de = 0x0606;
    m.step(0x0e62, 10);
    m.push16(0x0e63);
    m.step(0x0038, 11); // 0e62  rst 0x38
    m.call(0x0038);
  }
  m.ret(); // 0e63  ret
}
