// SPDX-License-Identifier: GPL-3.0-only

// loc_4809  (ROM 0x4809-0x482C, Time Pilot)
export function loc_4809(m) {
  const { regs, mem } = m;

  mem.write8((regs.ix + 0x00) & 0xffff, 0x3b);
  m.step(0x480d, 19); // ld (ix+0x00),0x3b

  m.push16(0x4810);
  m.step(0x57ff, 17); // call 0x57ff
  m.call(0x57ff);

  regs.a = mem.read8((regs.ix + 0x07) & 0xffff);
  m.step(0x4813, 19); // ld a,(ix+0x07) -- the table index

  regs.cp(0x04);
  m.step(0x4815, 7); // cp 0x04

  if (regs.fNC) {
    m.step(0x4824, 10); // jp nc,0x4824 taken -- index out of the table's range

    mem.write8((regs.iy + 0x01) & 0xffff, 0x8f);
    m.step(0x4828, 19); // ld (iy+0x01),0x8f

    mem.write8((regs.iy + 0x30) & 0xffff, 0x6c);
    m.step(0x482c, 19); // ld (iy+0x30),0x6c

    m.ret(); // 482c  ret
    return;
  }
  m.step(0x4818, 10); // jp nc NOT taken (jp costs 10 either way)

  regs.hl = 0x482d;
  m.step(0x481b, 10); // ld hl,0x482d -- table base: f9 fc 8d 8e

  m.push16(0x481c);
  m.step(0x0008, 11); // rst 0x08 -- A = (HL + A)
  m.call(0x0008);

  mem.write8((regs.iy + 0x01) & 0xffff, regs.a);
  m.step(0x481f, 19); // ld (iy+0x01),a

  mem.write8((regs.iy + 0x30) & 0xffff, 0x6c);
  m.step(0x4823, 19); // ld (iy+0x30),0x6c

  m.ret(); // 4823  ret
}
