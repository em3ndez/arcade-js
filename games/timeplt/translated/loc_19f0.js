// SPDX-License-Identifier: GPL-3.0-only

// loc_19f0  (ROM 0x19F0–0x1AE3)
export function loc_19f0(m) {
  const { regs, mem } = m;
  const IY = (d) => (regs.iy + d) & 0xffff;

  regs.hl = 0x0000;
  m.step(0x19f3, 10); // ld hl,0x0000
  mem.write16(0xa808, regs.hl);
  m.step(0x19f6, 16); // ld (0xa808),hl
  mem.write16(0xa80a, regs.hl);
  m.step(0x19f9, 16); // ld (0xa80a),hl
  mem.write16(0xad06, regs.hl);
  m.step(0x19fc, 16); // ld (0xad06),hl

  regs.xor(regs.a);
  m.step(0x19fd, 4); // xor a
  mem.write8(0xad0d, regs.a);
  m.step(0x1a00, 13); // ld (0xad0d),a
  mem.write8(0xa8f7, regs.a);
  m.step(0x1a03, 13); // ld (0xa8f7),a
  mem.write8(0xad05, regs.a);
  m.step(0x1a06, 13); // ld (0xad05),a

  regs.a = mem.read8(0xa9d6);
  m.step(0x1a09, 13); // ld a,(0xa9d6)
  mem.write8(0xa9d7, regs.a);
  m.step(0x1a0c, 13); // ld (0xa9d7),a
  regs.a = mem.read8(0xad0a);
  m.step(0x1a0f, 13); // ld a,(0xad0a)
  mem.write8(0xacc0, regs.a);
  m.step(0x1a12, 13); // ld (0xacc0),a

  regs.xor(regs.a);
  m.step(0x1a13, 4); // xor a
  mem.write8(0xaa81, regs.a);
  m.step(0x1a16, 13); // ld (0xaa81),a
  mem.write8(0xacc6, regs.a);
  m.step(0x1a19, 13); // ld (0xacc6),a

  regs.a = 0x80;
  m.step(0x1a1b, 7); // ld a,0x80
  mem.write8(0xa802, regs.a);
  m.step(0x1a1e, 13); // ld (0xa802),a
  regs.xor(regs.a);
  m.step(0x1a1f, 4); // xor a
  mem.write8(0xa801, regs.a);
  m.step(0x1a22, 13); // ld (0xa801),a
  regs.a = 0xff;
  m.step(0x1a24, 7); // ld a,0xff
  mem.write8(0xa800, regs.a);
  m.step(0x1a27, 13); // ld (0xa800),a
  regs.a = 0x78;
  m.step(0x1a29, 7); // ld a,0x78
  mem.write8(0xaa41, regs.a);
  m.step(0x1a2c, 13); // ld (0xaa41),a
  regs.a = 0x84;
  m.step(0x1a2e, 7); // ld a,0x84
  mem.write8(0xaa10, regs.a);
  m.step(0x1a31, 13); // ld (0xaa10),a

  m.push16(0x1a34);
  m.step(0x20af, 17); // call 0x20af
  m.call(0x20af);

  m.push16(0x1a37);
  m.step(0x2755, 17); // call 0x2755
  m.call(0x2755);

  regs.ix = 0xa8c0;
  m.step(0x1a3b, 14); // ld ix,0xa8c0
  regs.iy = 0xaa28;
  m.step(0x1a3f, 14); // ld iy,0xaa28

  m.push16(0x1a42);
  m.step(0x3c0d, 17); // call 0x3c0d
  m.call(0x3c0d);

  regs.b = 0x07;
  m.step(0x1a44, 7); // ld b,0x07 -- feeds the djnz at 0x1A6E
  regs.ix = 0xa850;
  m.step(0x1a48, 14); // ld ix,0xa850 -- DEAD, overwritten at 0x1A4C
  regs.iy = 0xaa1a;
  m.step(0x1a4c, 14); // ld iy,0xaa1a -- DEAD, overwritten at 0x1A50
  regs.ix = 0xa8e0;
  m.step(0x1a50, 14); // ld ix,0xa8e0
  regs.iy = 0xaa2c;
  m.step(0x1a54, 14); // ld iy,0xaa2c

  m.push16(0x1a57);
  m.step(0x3dfb, 17); // call 0x3dfb
  m.call(0x3dfb);

  regs.ix = 0xa8f0;
  m.step(0x1a5b, 14); // ld ix,0xa8f0
  regs.iy = 0xaa2e;
  m.step(0x1a5f, 14); // ld iy,0xaa2e

  m.push16(0x1a62);
  m.step(0x48ad, 17); // call 0x48ad
  m.call(0x48ad);

  do {
    m.push16(0x1a65);
    m.step(0x2bde, 17); // call 0x2bde
    m.call(0x2bde);

    regs.de = 0x0010;
    m.step(0x1a68, 10); // ld de,0x0010
    regs.addIx(regs.de);
    m.step(0x1a6a, 15); // add ix,de
    regs.iy = (regs.iy + 1) & 0xffff;
    m.step(0x1a6c, 10); // inc iy
    regs.iy = (regs.iy + 1) & 0xffff;
    m.step(0x1a6e, 10); // inc iy
    regs.djnz(); // affects NO flags
    m.step(regs.b !== 0 ? 0x1a62 : 0x1a70, regs.b !== 0 ? 13 : 8); // djnz 0x1a62
  } while (regs.b !== 0);

  m.push16(0x1a73);
  m.step(0x1ae4, 17); // call 0x1ae4
  m.call(0x1ae4);

  regs.iy = 0xaa28;
  m.step(0x1a77, 14); // ld iy,0xaa28

  const ZEROS = [
    [0x00, 0x1a7b], [0x02, 0x1a7f], [0x04, 0x1a83], [0x06, 0x1a87],
    [0x31, 0x1a8b], [0x33, 0x1a8f], [0x35, 0x1a93], [0x37, 0x1a97],
  ];
  for (const [d, next] of ZEROS) {
    mem.write8(IY(d), 0x00);
    m.step(next, 19); // ld (iy+0xNN),0x00
  }

  m.push16(0x1a9a);
  m.step(0x30a5, 17); // call 0x30a5
  m.call(0x30a5);

  regs.a = mem.read8(0xad04);
  m.step(0x1a9d, 13); // ld a,(0xad04)
  regs.rlca();
  m.step(0x1a9e, 4); // rlca
  regs.rlca();
  m.step(0x1a9f, 4); // rlca
  regs.rlca();
  m.step(0x1aa0, 4); // rlca
  regs.rlca();
  m.step(0x1aa1, 4); // rlca
  regs.and(0xf0);
  m.step(0x1aa3, 7); // and 0xf0
  regs.b = regs.a;
  m.step(0x1aa4, 4); // ld b,a
  regs.a = mem.read8(0xacc0);
  m.step(0x1aa7, 13); // ld a,(0xacc0)
  regs.add(regs.b);
  m.step(0x1aa8, 4); // add a,b
  regs.hl = 0x1b04;
  m.step(0x1aab, 10); // ld hl,0x1b04

  m.push16(0x1aac);
  m.step(0x0010, 11); // rst 0x10 -- DE = the word at 0x1B04 + 2*A, the doubling wrapped to 8 bits
  m.call(0x0010);

  regs.a = mem.read8(regs.de);
  m.step(0x1aad, 7); // ld a,(de)
  mem.write8(0xa844, regs.a);
  m.step(0x1ab0, 13); // ld (0xa844),a
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x1ab1, 6); // inc de

  regs.a = mem.read8(regs.de);
  m.step(0x1ab2, 7); // ld a,(de)
  mem.write8(0xa837, regs.a);
  m.step(0x1ab5, 13); // ld (0xa837),a
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x1ab6, 6); // inc de

  regs.a = mem.read8(regs.de);
  m.step(0x1ab7, 7); // ld a,(de)
  mem.write8(0xa827, regs.a);
  m.step(0x1aba, 13); // ld (0xa827),a
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x1abb, 6); // inc de

  regs.a = mem.read8(regs.de);
  m.step(0x1abc, 7); // ld a,(de)
  mem.write8(0xa817, regs.a);
  m.step(0x1abf, 13); // ld (0xa817),a
  mem.write8(0xa814, regs.a); // the SAME byte, twice
  m.step(0x1ac2, 13); // ld (0xa814),a
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x1ac3, 6); // inc de

  regs.a = mem.read8(regs.de);
  m.step(0x1ac4, 7); // ld a,(de)
  mem.write8(0xacc1, regs.a);
  m.step(0x1ac7, 13); // ld (0xacc1),a
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x1ac8, 6); // inc de

  regs.a = mem.read8(regs.de);
  m.step(0x1ac9, 7); // ld a,(de)
  mem.write8(0xacc4, regs.a);
  m.step(0x1acc, 13); // ld (0xacc4),a
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x1acd, 6); // inc de

  regs.a = mem.read8(regs.de);
  m.step(0x1ace, 7); // ld a,(de)
  mem.write8(0xa8c6, regs.a);
  m.step(0x1ad1, 13); // ld (0xa8c6),a
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x1ad2, 6); // inc de

  regs.a = mem.read8(regs.de);
  m.step(0x1ad3, 7); // ld a,(de)
  mem.write8(0xa8d6, regs.a);
  m.step(0x1ad6, 13); // ld (0xa8d6),a
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x1ad7, 6); // inc de

  regs.a = mem.read8(regs.de);
  m.step(0x1ad8, 7); // ld a,(de)
  mem.write8(0xa8e6, regs.a);
  m.step(0x1adb, 13); // ld (0xa8e6),a
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x1adc, 6); // inc de

  regs.a = mem.read8(regs.de);
  m.step(0x1add, 7); // ld a,(de)
  mem.write8(0xa8f4, regs.a);
  m.step(0x1ae0, 13); // ld (0xa8f4),a
  mem.write8(0xa8f6, regs.a); // the SAME byte, twice
  m.step(0x1ae3, 13); // ld (0xa8f6),a

  m.ret(); // 1ae3
}
