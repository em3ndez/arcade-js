// SPDX-License-Identifier: GPL-3.0-only

// loc_460e  (ROM 0x460E-0x4645)
export function loc_460e(m) {
  const { regs, mem } = m;
  const X = (d) => (regs.ix + d) & 0xffff;
  const Y = (d) => (regs.iy + d) & 0xffff;

  regs.hl = 0xa67c;
  m.step(0x4611, 10); // ld hl,0xa67c
  regs.a = mem.read8(regs.hl);
  m.step(0x4612, 7); // ld a,(hl)
  regs.c = regs.a;
  m.step(0x4613, 4); // ld c,a
  regs.a = mem.read8(0xab43);
  m.step(0x4616, 13); // ld a,(0xab43)
  regs.sub(regs.c);
  m.step(0x4617, 4); // sub c

  if (regs.fZ) {
    m.step(0x461a, 10); // jp nz,0x4643 NOT taken -- the two bytes agree
    m.ret(10); // 461a  ret
    return;
  }
  m.step(0x4643, 10); // jp nz,0x4643 taken

  m.step(0x461b, 10); // jp 0x461b -- into the animation table

  regs.sub(regs.h);
  m.step(0x461c, 4); // 461b  sub h   (table byte 0x94)
  regs.sub(mem.read8(regs.hl));
  m.step(0x461d, 7); // 461c  sub (hl) (0x96) -- reads 0xA67C
  regs.sub(mem.read8(regs.hl));
  m.step(0x461e, 7); // 461d  sub (hl) (0x96)
  regs.sub(regs.h);
  m.step(0x461f, 4); // 461e  sub h   (0x94)
  regs.sub(regs.d);
  m.step(0x4620, 4); // 461f  sub d   (0x92)
  regs.sub(regs.b);
  m.step(0x4621, 4); // 4620  sub b   (0x90)
  regs.sub(regs.b);
  m.step(0x4622, 4); // 4621  sub b   (0x90)
  regs.sub(regs.h);
  m.step(0x4623, 4); // 4622  sub h   (0x94) -- falls into real code

  regs.decMem8(mem, X(0x00));
  m.step(0x4626, 23); // dec (ix+0x00)
  mem.write8(Y(0x01), 0xfe);
  m.step(0x462a, 19); // ld (iy+0x01),0xfe
  mem.write8(Y(0x03), 0xfd);
  m.step(0x462e, 19); // ld (iy+0x03),0xfd
  mem.write8(Y(0x30), 0x6c);
  m.step(0x4632, 19); // ld (iy+0x30),0x6c
  mem.write8(Y(0x32), 0x6c);
  m.step(0x4636, 19); // ld (iy+0x32),0x6c

  regs.a = mem.read8(0xa800);
  m.step(0x4639, 13); // ld a,(0xa800)
  regs.a = regs.inc8(regs.a);
  m.step(0x463a, 4); // inc a -- Z iff (0xA800) was 0xFF
  if (regs.fZ) {
    m.push16(0x463d);
    m.step(0x580b, 17); // call z,0x580b taken
    m.call(0x580b);
  } else {
    m.step(0x463d, 10); // call z NOT taken
  }

  regs.de = 0x040d;
  m.step(0x4640, 10); // ld de,0x040d
  m.step(0x0038, 10); // jp 0x0038 -- TAIL into the ring-buffer enqueue
  return m.call(0x0038);
}
