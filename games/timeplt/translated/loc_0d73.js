// SPDX-License-Identifier: GPL-3.0-only

// loc_0d73  (ROM 0x0D73–0x0D80)
export function loc_0d73(m) {
  const { regs } = m;

  regs.b = 0x00;
  m.step(0x0d75, 7); // ld b,0x00

  m.push16(0x0d78);
  m.step(0x0da0, 17); // call 0x0da0
  m.call(0x0da0);

  regs.hl = (regs.hl - 1) & 0xffff; // dec hl -- 16-bit, no flags
  m.step(0x0d79, 6); // dec hl

  m.push16(0x0d7c);
  m.step(0x0da0, 17); // call 0x0da0
  m.call(0x0da0);

  regs.hl = (regs.hl - 1) & 0xffff;
  m.step(0x0d7d, 6); // dec hl

  m.push16(0x0d80);
  m.step(0x0d81, 17); // call 0x0d81
  m.call(0x0d81);

  m.ret(); // 0x0d80
}
