// SPDX-License-Identifier: GPL-3.0-only

// loc_2530  (ROM 0x2530-0x256E, Time Pilot)
export function loc_2530(m) {
  const { regs } = m;

  regs.addHl(regs.de);
  m.step(0x2531, 11); // 2530  add hl,de
  regs.bc = 0x0118;
  m.step(0x2534, 10); // 2531  ld bc,0x0118
  regs.rla();
  m.step(0x2535, 4); // 2534  rla
  regs.bc = 0x0116;
  m.step(0x2538, 10); // 2535  ld bc,0x0116
  regs.d = regs.dec8(regs.d);
  m.step(0x2539, 4); // 2538  dec d
  regs.bc = 0x0114;
  m.step(0x253c, 10); // 2539  ld bc,0x0114
  regs.de = (regs.de + 1) & 0xffff; // inc rr sets no flags
  m.step(0x253d, 6); // 253c  inc de
  regs.bc = 0x0110;
  m.step(0x2540, 10); // 253d  ld bc,0x0110
  regs.c = 0x01;
  m.step(0x2542, 7); // 2540  ld c,0x01
  regs.c = regs.inc8(regs.c);
  m.step(0x2543, 4); // 2542  inc c
  regs.bc = 0x010a;
  m.step(0x2546, 10); // 2543  ld bc,0x010a
  regs.exAf();
  m.step(0x2547, 4); // 2546  ex af,af'
  regs.bc = 0x0104;
  m.step(0x254a, 10); // 2547  ld bc,0x0104
  regs.bc = 0xff01;
  m.step(0x254d, 10); // 254a  ld bc,0xff01
  m.step(0x254e, 4); // 254d  nop

  m.step(0x254f, 4); // 254e  ei
  m.step(0x2550, 4); // 254f  nop

  if (regs.fM) {
    m.ret(11); // 2550  ret m taken -- unwinds to loc_2730's caller
    return;
  }
  m.step(0x2551, 5); // 2550  ret m not taken

  m.step(0x2552, 4); // 2551  nop
  m.push16(regs.af);
  m.step(0x2553, 11); // 2552  push af
  m.step(0x2554, 4); // 2553  nop

  if (regs.fP) {
    m.step(0xee00, 10); // 2554  jp p,0xee00 taken -- UNMAPPED
    return m.call(0xee00);
  }
  m.step(0x2557, 10); // 2554  jp p not taken

  m.step(0x2558, 4); // 2557  nop
  regs.exDeHl();
  m.step(0x2559, 4); // 2558  ex de,hl
  m.step(0x255a, 4); // 2559  nop

  if (regs.fPE) {
    m.ret(11); // 255a  ret pe taken -- unwinds to loc_2730's caller
    return;
  }
  m.step(0x255b, 5); // 255a  ret pe not taken

  m.step(0x255c, 4); // 255b  nop

  if (regs.fPO) {
    m.push16(0x255f);
    m.step(0xe100, 17); // 255c  call po,0xe100 taken -- UNMAPPED
    m.call(0xe100);
  } else {
    m.step(0x255f, 10); // 255c  call po not taken
  }

  m.step(0x2560, 4); // 255f  nop
  regs.sbc(0x00);
  m.step(0x2562, 7); // 2560  sbc a,0x00

  if (regs.fC) {
    m.step(0xd700, 10); // 2562  jp c,0xd700 taken -- UNMAPPED
    return m.call(0xd700);
  }
  m.step(0x2565, 10); // 2562  jp c not taken

  m.step(0x2566, 4); // 2565  nop

  if (regs.fNC) {
    m.push16(0x2569);
    m.step(0xd100, 17); // 2566  call nc,0xd100 taken -- UNMAPPED
    m.call(0xd100);
  } else {
    m.step(0x2569, 10); // 2566  call nc not taken
  }

  m.step(0x256a, 4); // 2569  nop

  m.push16(0x256d);
  m.step(0xca00, 17); // 256a  call 0xca00 -- UNMAPPED
  m.call(0xca00);

  m.step(0x256e, 4); // 256d  nop

  m.push16(0x256f);
  m.step(0x0000, 11); // 256e  rst 0x00
  return m.call(0x0000);
}
