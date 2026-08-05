// SPDX-License-Identifier: GPL-3.0-only

// loc_3e36  (ROM 0x3E36–0x3E62)
export function loc_3e36(m) {
  const { regs } = m;

  regs.ix = 0xa810;
  m.step(0x3e3a, 14); // ld ix,0xa810
  regs.iy = 0xaa12;
  m.step(0x3e3e, 14); // ld iy,0xaa12
  m.push16(0x3e41);
  m.step(0x3e63, 17); // call 0x3e63
  m.call(0x3e63);

  regs.ix = 0xa820;
  m.step(0x3e45, 14); // ld ix,0xa820
  regs.iy = 0xaa14;
  m.step(0x3e49, 14); // ld iy,0xaa14
  m.push16(0x3e4c);
  m.step(0x3e63, 17); // call 0x3e63
  m.call(0x3e63);

  regs.ix = 0xa830;
  m.step(0x3e50, 14); // ld ix,0xa830
  regs.iy = 0xaa16;
  m.step(0x3e54, 14); // ld iy,0xaa16
  m.push16(0x3e57);
  m.step(0x3e63, 17); // call 0x3e63
  m.call(0x3e63);

  regs.ix = 0xa840;
  m.step(0x3e5b, 14); // ld ix,0xa840
  regs.iy = 0xaa18;
  m.step(0x3e5f, 14); // ld iy,0xaa18
  m.push16(0x3e62);
  m.step(0x3e63, 17); // call 0x3e63
  m.call(0x3e63);

  m.ret(); // 3e62
}
