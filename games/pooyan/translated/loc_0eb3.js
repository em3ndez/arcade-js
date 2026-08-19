// SPDX-License-Identifier: GPL-3.0-only

// loc_0eb3  (ROM 0x0eb3-0x0ece) -- enqueue A into the sound-command ring buffer
// (slots 0x8a43..0x8a5e); the write pointer at 0x8a40 advances, wrapping 0x5e -> 0x43.
export function loc_0eb3(m) {
  const { regs, mem } = m;

  m.push16(regs.bc);
  m.step(0x0eb4, 11); // 0eb3  push bc/de/hl
  m.push16(regs.de);
  m.step(0x0eb5, 11);
  m.push16(regs.hl);
  m.step(0x0eb6, 11);
  regs.b = regs.a;
  m.step(0x0eb7, 4); // 0eb6  ld b,a -- hold the byte to enqueue
  regs.de = 0x8a40;
  m.step(0x0eba, 10); // 0eb7  ld de,0x8a40 -- pointer cell
  regs.a = mem.read8(regs.de);
  m.step(0x0ebb, 7); // 0eba  ld a,(de) -- current pointer (low byte)
  regs.l = regs.a;
  m.step(0x0ebc, 4);
  regs.h = 0x8a;
  m.step(0x0ebe, 7); // 0ebc  ld h,0x8a -- HL = 0x8a{ptr}
  mem.write8(regs.hl, regs.b);
  m.step(0x0ebf, 7); // 0ebe  ld (hl),b -- store into the ring slot
  regs.a = regs.l;
  m.step(0x0ec0, 4);
  regs.cp(0x5e);
  m.step(0x0ec2, 7); // 0ec0  cp 0x5e -- at the last slot?

  if (regs.fZ) {
    m.step(0x0ec8, 12); // 0ec2  jr z (taken) -- wrap to 0x43
    regs.a = 0x43;
    m.step(0x0eca, 7);
    mem.write8(regs.de, regs.a);
    m.step(0x0ecb, 7);
  } else {
    m.step(0x0ec4, 7); // 0ec2  jr z (not taken) -- advance
    regs.a = regs.inc8(regs.a);
    m.step(0x0ec5, 4); // 0ec4  inc a
    mem.write8(regs.de, regs.a);
    m.step(0x0ec6, 7);
    m.step(0x0ecb, 12); // 0ec6  jr 0x0ecb
  }

  regs.hl = m.pop16();
  m.step(0x0ecc, 10); // 0ecb  pop hl/de/bc
  regs.de = m.pop16();
  m.step(0x0ecd, 10);
  regs.bc = m.pop16();
  m.step(0x0ece, 10);
  m.ret(); // 0ece  ret
}
