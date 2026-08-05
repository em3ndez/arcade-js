// SPDX-License-Identifier: GPL-3.0-only

// loc_4c1f  (ROM 0x4C1F–0x4C74)
export function loc_4c1f(m) {
  const { regs, mem } = m;

  m.push16(regs.hl);
  m.step(0x4c20, 11); // push hl
  regs.a = mem.read8(regs.hl);
  m.step(0x4c21, 7); // ld a,(hl)
  regs.add(regs.a);
  m.step(0x4c22, 4); // add a,a
  regs.add(mem.read8(regs.hl));
  m.step(0x4c23, 7); // add a,(hl)
  regs.hl = 0x4cb4;
  m.step(0x4c26, 10); // ld hl,0x4cb4
  m.push16(0x4c27);
  m.step(0x0008, 11); // rst 0x08 -- A = (HL + A)
  m.call(0x0008);

  mem.write8(regs.de, regs.a);
  m.step(0x4c28, 7); // ld (de),a
  regs.d = regs.res(2, regs.d); // no flags
  m.step(0x4c2a, 8); // res 2,d
  regs.a = regs.c;
  m.step(0x4c2b, 4); // ld a,c
  mem.write8(regs.de, regs.a);
  m.step(0x4c2c, 7); // ld (de),a
  regs.d = regs.set(2, regs.d); // no flags
  m.step(0x4c2e, 8); // set 2,d
  regs.hl = (regs.hl + 1) & 0xffff; // inc hl -- 16-bit, no flags
  m.step(0x4c2f, 6); // inc hl
  m.push16(0x4c30);
  m.step(0x0020, 11); // rst 0x20 -- DE -= 0x20
  m.call(0x0020);

  regs.a = mem.read8(regs.hl);
  m.step(0x4c31, 7); // ld a,(hl)
  mem.write8(regs.de, regs.a);
  m.step(0x4c32, 7); // ld (de),a
  regs.d = regs.res(2, regs.d);
  m.step(0x4c34, 8); // res 2,d
  regs.a = regs.c;
  m.step(0x4c35, 4); // ld a,c
  mem.write8(regs.de, regs.a);
  m.step(0x4c36, 7); // ld (de),a
  regs.d = regs.set(2, regs.d);
  m.step(0x4c38, 8); // set 2,d
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x4c39, 6); // inc hl
  m.push16(0x4c3a);
  m.step(0x0020, 11); // rst 0x20
  m.call(0x0020);

  regs.a = mem.read8(regs.hl);
  m.step(0x4c3b, 7); // ld a,(hl)
  mem.write8(regs.de, regs.a);
  m.step(0x4c3c, 7); // ld (de),a
  regs.d = regs.res(2, regs.d);
  m.step(0x4c3e, 8); // res 2,d
  regs.a = regs.c;
  m.step(0x4c3f, 4); // ld a,c
  mem.write8(regs.de, regs.a);
  m.step(0x4c40, 7); // ld (de),a
  regs.d = regs.set(2, regs.d);
  m.step(0x4c42, 8); // set 2,d

  regs.hl = 0xff80;
  m.step(0x4c45, 10); // ld hl,0xff80
  regs.addHl(regs.de);
  m.step(0x4c46, 11); // add hl,de
  regs.exDeHl();
  m.step(0x4c47, 4); // ex de,hl
  regs.hl = m.pop16();
  m.step(0x4c48, 10); // pop hl
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x4c49, 6); // inc hl
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x4c4a, 6); // inc hl
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x4c4b, 6); // inc hl
  m.push16(0x4c4e);
  m.step(0x0d73, 17); // call 0x0d73
  m.call(0x0d73);

  m.push16(regs.hl);
  m.step(0x4c4f, 11); // push hl
  regs.hl = 0xffa0;
  m.step(0x4c52, 10); // ld hl,0xffa0
  regs.addHl(regs.de);
  m.step(0x4c53, 11); // add hl,de
  regs.exDeHl();
  m.step(0x4c54, 4); // ex de,hl
  regs.hl = m.pop16();
  m.step(0x4c55, 10); // pop hl
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x4c56, 6); // inc hl
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x4c57, 6); // inc hl
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x4c58, 6); // inc hl

  regs.a = mem.read8(regs.hl);
  m.step(0x4c59, 7); // ld a,(hl)
  mem.write8(regs.de, regs.a);
  m.step(0x4c5a, 7); // ld (de),a
  regs.d = regs.res(2, regs.d);
  m.step(0x4c5c, 8); // res 2,d
  regs.a = regs.c;
  m.step(0x4c5d, 4); // ld a,c
  mem.write8(regs.de, regs.a);
  m.step(0x4c5e, 7); // ld (de),a
  regs.d = regs.set(2, regs.d);
  m.step(0x4c60, 8); // set 2,d
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x4c61, 6); // inc hl
  m.push16(0x4c62);
  m.step(0x0020, 11); // rst 0x20
  m.call(0x0020);

  regs.a = mem.read8(regs.hl);
  m.step(0x4c63, 7); // ld a,(hl)
  mem.write8(regs.de, regs.a);
  m.step(0x4c64, 7); // ld (de),a
  regs.d = regs.res(2, regs.d);
  m.step(0x4c66, 8); // res 2,d
  regs.a = regs.c;
  m.step(0x4c67, 4); // ld a,c
  mem.write8(regs.de, regs.a);
  m.step(0x4c68, 7); // ld (de),a
  regs.d = regs.set(2, regs.d);
  m.step(0x4c6a, 8); // set 2,d
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x4c6b, 6); // inc hl
  m.push16(0x4c6c);
  m.step(0x0020, 11); // rst 0x20
  m.call(0x0020);

  regs.a = mem.read8(regs.hl);
  m.step(0x4c6d, 7); // ld a,(hl)
  mem.write8(regs.de, regs.a);
  m.step(0x4c6e, 7); // ld (de),a
  regs.d = regs.res(2, regs.d);
  m.step(0x4c70, 8); // res 2,d
  regs.a = regs.c;
  m.step(0x4c71, 4); // ld a,c
  mem.write8(regs.de, regs.a);
  m.step(0x4c72, 7); // ld (de),a
  regs.d = regs.set(2, regs.d);
  m.step(0x4c74, 8); // set 2,d

  m.ret(); // 0x4c74
}
