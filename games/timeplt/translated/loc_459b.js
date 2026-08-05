// SPDX-License-Identifier: GPL-3.0-only

// loc_459b  (ROM 0x459B-0x460D, 0x4623-0x4642 and 0x4646-0x4662, Time Pilot)
export function loc_459b(m) {
  const { regs, mem } = m;
  const X = (d) => (regs.ix + d) & 0xffff;
  const Y = (d) => (regs.iy + d) & 0xffff;

  let label = 0x459b;
  for (;;) {
    switch (label) {
      case 0x459b:
        regs.d = 0xa7;
        m.step(0x459d, 7); // ld d,0xa7
        regs.de = (regs.de + 1) & 0xffff; // 16-bit INC: no flags
        m.step(0x459e, 6); // inc de
        regs.sub(mem.read8(regs.hl));
        m.step(0x459f, 7); // sub (hl)
        m.step(0x45a1, 8); // ed dc -- undefined ED opcode, behaves as two NOPs
        regs.af = m.pop16();
        m.step(0x45a2, 10); // pop af -- eats the caller's return address
        regs.adc(regs.h);
        m.step(0x45a3, 4); // adc a,h
        regs.l = regs.b;
        m.step(0x45a4, 4); // ld l,b
        regs.sp = (regs.sp - 1) & 0xffff;
        m.step(0x45a5, 6); // dec sp -- the stack is now misaligned by one byte
        regs.c = regs.dec8(regs.c);
        m.step(0x45a6, 4); // dec c
        m.step(0x45a8, 8); // ed f1 -- undefined ED opcode, behaves as two NOPs
        regs.sbc(regs.e);
        m.step(0x45a9, 4); // sbc a,e
        regs.de = (regs.de + 1) & 0xffff;
        m.step(0x45aa, 6); // inc de
        regs.de = (regs.de + 1) & 0xffff;
        m.step(0x45ab, 6); // inc de
        regs.de = (regs.de + 1) & 0xffff;
        m.step(0x45ac, 6); // inc de
        regs.de = (regs.de + 1) & 0xffff;
        m.step(0x45ad, 6); // inc de
        regs.af = m.pop16();
        m.step(0x45ae, 10); // pop af -- reads a misaligned word, F is now garbage
        regs.adc(regs.b);
        m.step(0x45af, 4); // adc a,b
        if (regs.fC) {
          m.push16(0x45b2);
          m.step(0x11ed, 17); // call c,0x11ed taken
          m.call(0x11ed);
        } else {
          m.step(0x45b2, 10); // call c NOT taken
        }
        regs.cp(regs.c);
        m.step(0x45b3, 4); // cp c

      case 0x45b3:
        m.push16(0x45b6);
        m.step(0x2b60, 17); // call 0x2b60
        m.call(0x2b60);

        regs.a = mem.read8(Y(0x31));
        m.step(0x45b9, 19); // ld a,(iy+0x31)
        regs.b = regs.a;
        m.step(0x45ba, 4); // ld b,a
        regs.add(0x13);
        m.step(0x45bc, 7); // add a,0x13
        regs.cp(0x03);
        m.step(0x45be, 7); // cp 0x03
        if (regs.fC) {
          m.step(0x45d5, 12); // jr c,0x45d5 taken -- (iy+0x31) in 0xED..0xEF
          label = 0x45d5;
          continue;
        }
        m.step(0x45c0, 7); // jr c NOT taken

        regs.a = regs.b;
        m.step(0x45c1, 4); // ld a,b
        regs.add(0x10);
        m.step(0x45c3, 7); // add a,0x10
        mem.write8(Y(0x33), regs.a);
        m.step(0x45c6, 19); // ld (iy+0x33),a
        regs.a = mem.read8(Y(0x00));
        m.step(0x45c9, 19); // ld a,(iy+0x00)
        regs.b = regs.a;
        m.step(0x45ca, 4); // ld b,a
        regs.add(0x08);
        m.step(0x45cc, 7); // add a,0x08
        regs.cp(0x28);
        m.step(0x45ce, 7); // cp 0x28
        if (regs.fC) {
          m.step(0x45d5, 12); // jr c,0x45d5 taken -- 8-bit: (iy+0x00) + 8 < 0x28
          label = 0x45d5;
          continue;
        }
        m.step(0x45d0, 7); // jr c NOT taken

        mem.write8(Y(0x02), regs.b);
        m.step(0x45d3, 19); // ld (iy+0x02),b
        m.step(0x45dd, 12); // jr 0x45dd
        label = 0x45dd;
        continue;

      case 0x45d5:
        mem.write8(Y(0x01), 0xff);
        m.step(0x45d9, 19); // ld (iy+0x01),0xff
        mem.write8(Y(0x03), 0xff);
        m.step(0x45dd, 19); // ld (iy+0x03),0xff

      case 0x45dd:
        regs.a = mem.read8(X(0x00));
        m.step(0x45e0, 19); // ld a,(ix+0x00)
        regs.cp(0xb4);
        m.step(0x45e2, 7); // cp 0xb4
        if (regs.fZ) {
          m.step(0x4623, 12); // jr z,0x4623 taken
          label = 0x4623;
          continue;
        }
        m.step(0x45e4, 7); // jr z NOT taken -- the carry from 0x45E0 is still live

        if (regs.fC) {
          m.step(0x45f9, 12); // jr c,0x45f9 taken -- state < 0xb4
          label = 0x45f9;
          continue;
        }
        m.step(0x45e6, 7); // jr c NOT taken

        regs.sub(0xb4);
        m.step(0x45e8, 7); // sub 0xb4
        regs.rrca();
        m.step(0x45e9, 4); // rrca
        regs.rrca();
        m.step(0x45ea, 4); // rrca
        regs.rrca();
        m.step(0x45eb, 4); // rrca -- (state - 0xB4) / 8
        regs.a = regs.dec8(regs.a);
        m.step(0x45ec, 4); // dec a
        regs.and(0x07);
        m.step(0x45ee, 7); // and 0x07 -- an eight-frame cycle
        regs.hl = 0x461b;
        m.step(0x45f1, 10); // ld hl,0x461b -- the 8-byte ROM table

        m.push16(0x45f2);
        m.step(0x0008, 11); // rst 0x08 -- A = table[A]
        m.call(0x0008);

        mem.write8(Y(0x03), regs.a);
        m.step(0x45f5, 19); // ld (iy+0x03),a
        regs.a = regs.inc8(regs.a);
        m.step(0x45f6, 4); // inc a
        mem.write8(Y(0x01), regs.a);
        m.step(0x45f9, 19); // ld (iy+0x01),a -- one more than the cell above

      case 0x45f9:
        regs.decMem8(mem, X(0x00));
        m.step(0x45fc, 23); // dec (ix+0x00)
        if (regs.fZ) {
          m.step(0x4646, 10); // jp z,0x4646 taken -- the sequence is over
          label = 0x4646;
          continue;
        }
        m.step(0x45ff, 10); // jp z NOT taken

        regs.a = mem.read8(X(0x00));
        m.step(0x4602, 19); // ld a,(ix+0x00)
        regs.cp(0x5a);
        m.step(0x4604, 7); // cp 0x5a
        if (regs.fNZ) {
          m.ret(11); // ret nz taken
          return;
        }
        m.step(0x4605, 5); // ret nz NOT taken

        mem.write8(Y(0x01), 0xff);
        m.step(0x4609, 19); // ld (iy+0x01),0xff
        mem.write8(Y(0x03), 0xff);
        m.step(0x460d, 19); // ld (iy+0x03),0xff
        m.ret(10); // 460d  ret
        return;

      case 0x4623:
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

      case 0x4646:
        regs.a = 0xff;
        m.step(0x4648, 7); // ld a,0xff
        mem.write8(0xacc6, regs.a);
        m.step(0x464b, 13); // ld (0xacc6),a
        mem.write8(X(0x00), 0x00);
        m.step(0x464f, 19); // ld (ix+0x00),0x00 -- back to the idle state
        regs.hl = 0xab43;
        m.step(0x4652, 10); // ld hl,0xab43
        regs.a = mem.read8(regs.hl);
        m.step(0x4653, 7); // ld a,(hl)
        regs.cp(0x7c);
        m.step(0x4655, 7); // cp 0x7c
        if (regs.fNZ) {
          m.step(0x4660, 10); // jp nz,0x4660 taken -- (0xab43) != 0x7c
        } else {
          m.step(0x4658, 10); // jp nz NOT taken
          regs.hl = (regs.hl + 1) & 0xffff;
          m.step(0x4659, 6); // inc hl -- 0xAB44
          regs.a = mem.read8(regs.hl);
          m.step(0x465a, 7); // ld a,(hl)
          regs.cp(0x10);
          m.step(0x465c, 7); // cp 0x10
          if (regs.fZ) {
            m.ret(11); // ret z taken
            return;
          }
          m.step(0x465d, 5); // ret z NOT taken
          regs.cp(0x05);
          m.step(0x465f, 7); // cp 0x05
          if (regs.fZ) {
            m.ret(11); // ret z taken
            return;
          }
          m.step(0x4660, 5); // ret z NOT taken
        }

        m.step(0x459b, 10); // jp 0x459b
        label = 0x459b;
        continue;
    }
  }
}
