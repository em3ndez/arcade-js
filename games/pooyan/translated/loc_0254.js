// SPDX-License-Identifier: GPL-3.0-only

// loc_0254  (ROM 0x0254-0x02A7) -- the per-frame worker dispatched by loc_020f.
// The low nibble of (0x883f) gates one path (call 0x208c); otherwise it walks a
// sprite-scroll update over 0x8740/0x84e0 through helpers 0x02a8/0x02aa/0x02b1.
// B keeps the whole (0x883f) byte for the `bit 4,b` test near the end.
export function loc_0254(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x883f);
  m.step(0x0257, 13);
  regs.b = regs.a;
  m.step(0x0258, 4);
  regs.and(0x0f);
  m.step(0x025a, 7);
  if (!regs.fZ) {
    m.step(0x025d, 10); // jp z,0x0261 not taken
    m.push16(0x0260);
    m.step(0x208c, 17);
    m.call(0x208c);
    m.ret(); // 0260 ret
    return;
  }
  m.step(0x0261, 10); // jp z,0x0261 taken

  regs.a = mem.read8(0x8806);
  m.step(0x0264, 13);
  regs.and(regs.a);
  m.step(0x0265, 4);
  if (regs.fZ) {
    m.ret(11); // 0265 ret z taken
    return;
  }
  m.step(0x0266, 5); // ret z not taken

  regs.de = 0xffe0;
  m.step(0x0269, 10);
  regs.hl = 0x84e0;
  m.step(0x026c, 10);
  regs.a = mem.read8(0x880e);
  m.step(0x026f, 13);
  regs.and(regs.a);
  m.step(0x0270, 4);
  if (regs.fZ) {
    m.step(0x0294, 12); // jr z,0x0294 taken
    regs.hl = 0x84e0;
    m.step(0x0297, 10);
    m.push16(0x029a);
    m.step(0x02b1, 17);
    m.call(0x02b1);
    regs.hl = 0x8521;
    m.step(0x029d, 10);
    m.push16(0x02a0);
    m.step(0x02b1, 17);
    m.call(0x02b1);
    m.push16(0x02a3);
    m.step(0x02b1, 17);
    m.call(0x02b1);
    m.push16(0x02a6);
    m.step(0x02b1, 17);
    m.call(0x02b1);
    m.step(0x0277, 12); // jr 0x0277 -> shared tail
  } else {
    m.step(0x0272, 7); // jr z not taken
    mem.write8(regs.hl, 0x02);
    m.step(0x0274, 10);
    m.push16(0x0277);
    m.step(0x02aa, 17);
    m.call(0x02aa); // returns into the shared tail at 0x0277
  }

  // 0277: shared tail (entered by the jr above or the 0x02aa return).
  regs.hl = 0x8740;
  m.step(0x027a, 10);
  m.push16(0x027d);
  m.step(0x02a8, 17);
  m.call(0x02a8);
  regs.a = mem.read8(0x880d);
  m.step(0x0280, 13);
  regs.and(regs.a);
  m.step(0x0281, 4);
  regs.hl = 0x8740;
  m.step(0x0284, 10);
  if (regs.fZ) {
    m.step(0x0289, 12); // jr z,0x0289 taken
  } else {
    m.step(0x0286, 7); // jr z not taken
    regs.hl = 0x84e0;
    m.step(0x0289, 10);
  }

  const bit4 = regs.bit(4, regs.b);
  m.step(0x028b, 8);
  if (!bit4) {
    m.ret(11); // 028b ret z taken (bit 4 clear)
    return;
  }
  m.step(0x028c, 5); // ret z not taken

  regs.a = mem.read8(0x8806);
  m.step(0x028f, 13);
  regs.rrca();
  m.step(0x0290, 4);
  if (regs.fNC) {
    m.ret(11); // 0290 ret nc taken
    return;
  }
  m.step(0x0291, 5); // ret nc not taken
  m.step(0x02b1, 10); // jp 0x02b1
  return m.call(0x02b1);
}
