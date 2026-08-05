// SPDX-License-Identifier: GPL-3.0-only

// loc_27b1  (ROM 0x27B1-0x28A0, Time Pilot)
export function loc_27b1(m) {
  const { regs, mem } = m;

  m.push16(0x27b4);
  m.step(0x5834, 17); // 27b1  call 0x5834
  m.call(0x5834);

  regs.a = 0x78;
  m.step(0x27b6, 7); // 27b4  ld a,0x78
  mem.write8(0xac64, regs.a);
  m.step(0x27b9, 13); // 27b6  ld (0xac64),a
  regs.a = 0x84;
  m.step(0x27bb, 7); // 27b9  ld a,0x84
  mem.write8(0xac65, regs.a);
  m.step(0x27be, 13); // 27bb  ld (0xac65),a

  regs.hl = 0x0000;
  m.step(0x27c1, 10); // 27be  ld hl,0x0000
  mem.write16(0xad16, regs.hl);
  m.step(0x27c4, 16); // 27c1  ld (0xad16),hl
  mem.write16(0xad26, regs.hl);
  m.step(0x27c7, 16); // 27c4  ld (0xad26),hl

  regs.a = mem.read8(0xa9cd);
  m.step(0x27ca, 13); // 27c7  ld a,(0xa9cd)
  mem.write8(0xad12, regs.a);
  m.step(0x27cd, 13); // 27ca  ld (0xad12),a
  mem.write8(0xad22, regs.a);
  m.step(0x27d0, 13); // 27cd  ld (0xad22),a

  regs.xor(regs.a);
  m.step(0x27d1, 4); // 27d0  xor a
  mem.write8(0xad14, regs.a);
  m.step(0x27d4, 13); // 27d1  ld (0xad14),a
  mem.write8(0xad24, regs.a);
  m.step(0x27d7, 13); // 27d4  ld (0xad24),a
  mem.write8(0xad32, regs.a);
  m.step(0x27da, 13); // 27d7  ld (0xad32),a
  mem.write8(0xad13, regs.a);
  m.step(0x27dd, 13); // 27da  ld (0xad13),a
  mem.write8(0xad23, regs.a);
  m.step(0x27e0, 13); // 27dd  ld (0xad23),a
  mem.write8(0xad1d, regs.a);
  m.step(0x27e3, 13); // 27e0  ld (0xad1d),a
  mem.write8(0xad2d, regs.a);
  m.step(0x27e6, 13); // 27e3  ld (0xad2d),a
  mem.write8(0xad0c, regs.a);
  m.step(0x27e9, 13); // 27e6  ld (0xad0c),a

  regs.a = regs.inc8(regs.a);
  m.step(0x27ea, 4); // 27e9  inc a -- A = 1
  mem.write8(0xad11, regs.a);
  m.step(0x27ed, 13); // 27ea  ld (0xad11),a
  mem.write8(0xad21, regs.a);
  m.step(0x27f0, 13); // 27ed  ld (0xad21),a
  mem.write8(0xad1e, regs.a);
  m.step(0x27f3, 13); // 27f0  ld (0xad1e),a
  mem.write8(0xad2e, regs.a);
  m.step(0x27f6, 13); // 27f3  ld (0xad2e),a

  regs.a = mem.read8(0xad30);
  m.step(0x27f9, 13); // 27f6  ld a,(0xad30)
  regs.and(regs.a);
  m.step(0x27fa, 4); // 27f9  and a

  if (regs.fZ) {
    m.step(0x2835, 12); // 27fa  jr z,0x2835 taken
  } else {
    m.step(0x27fc, 7); // 27fa  jr z not taken

    regs.xor(regs.a);
    m.step(0x27fd, 4); // 27fc  xor a
    regs.h = regs.a;
    m.step(0x27fe, 4); // 27fd  ld h,a
    regs.l = regs.a;
    m.step(0x27ff, 4); // 27fe  ld l,a -- HL = 0
    mem.write8(0xad33, regs.a);
    m.step(0x2802, 13); // 27ff  ld (0xad33),a
    mem.write16(0xad34, regs.hl);
    m.step(0x2805, 16); // 2802  ld (0xad34),hl
    mem.write8(0xad36, regs.a);
    m.step(0x2808, 13); // 2805  ld (0xad36),a
    mem.write16(0xad37, regs.hl);
    m.step(0x280b, 16); // 2808  ld (0xad37),hl

    regs.de = 0x0400;
    m.step(0x280e, 10); // 280b  ld de,0x0400

    m.push16(0x280f);
    m.step(0x0038, 11); // 280e  rst 0x38
    m.call(0x0038);

    regs.a = mem.read8(0xa9c4);
    m.step(0x2812, 13); // 280f  ld a,(0xa9c4)

    m.push16(0x2815);
    m.step(0x0f7b, 17); // 2812  call 0x0f7b
    m.call(0x0f7b);

    regs.b = 0x00;
    m.step(0x2817, 7); // 2815  ld b,0x00 -- 256 djnz passes
    regs.hl = 0x1550;
    m.step(0x281a, 10); // 2817  ld hl,0x1550
    regs.sub(regs.a);
    m.step(0x281b, 4); // 281a  sub a -- A = 0, carry cleared

    for (;;) {
      regs.xor(mem.read8(regs.hl));
      m.step(0x281c, 7); // 281b  xor (hl)
      regs.hl = (regs.hl + 1) & 0xffff;
      m.step(0x281d, 6); // 281c  inc hl
      if (regs.djnz() !== 0) {
        m.step(0x281b, 13); // djnz taken
        continue;
      }
      m.step(0x281f, 8); // djnz not taken
      break;
    }

    regs.add(0x01);
    m.step(0x2821, 7); // 281f  add a,0x01
    mem.write8(0xc308, regs.a, 10);
    m.step(0x2824, 13); // 2821  ld (0xc308),a -- the LS259 latch

    regs.a = mem.read8(0xa9d3);
    m.step(0x2827, 13); // 2824  ld a,(0xa9d3)
    mem.write8(0xad1a, regs.a);
    m.step(0x282a, 13); // 2827  ld (0xad1a),a
    mem.write8(0xad2a, regs.a);
    m.step(0x282d, 13); // 282a  ld (0xad2a),a

    regs.a = 0x96;
    m.step(0x282f, 7); // 282d  ld a,0x96
    mem.write8(0xa9eb, regs.a);
    m.step(0x2832, 13); // 282f  ld (0xa9eb),a

    m.step(0x0f1a, 10); // 2832  jp 0x0f1a -- TAIL JUMP
    return m.call(0x0f1a);
  }

  regs.hl = 0xa9d0;
  m.step(0x2838, 10); // 2835  ld hl,0xa9d0
  regs.a = mem.read8(regs.hl);
  m.step(0x2839, 7); // 2838  ld a,(hl)
  regs.a = regs.inc8(regs.a);
  m.step(0x283a, 4); // 2839  inc a
  regs.cp(0x04);
  m.step(0x283c, 7); // 283a  cp 0x04

  if (regs.fC) {
    m.step(0x2840, 12); // 283c  jr c,0x2840 taken -- below 4, keep it
  } else {
    m.step(0x283e, 7); // 283c  jr c not taken
    regs.a = 0x01;
    m.step(0x2840, 7); // 283e  ld a,0x01 -- wrap back to 1
  }

  mem.write8(regs.hl, regs.a);
  m.step(0x2841, 7); // 2840  ld (hl),a
  mem.write8(0xad14, regs.a);
  m.step(0x2844, 13); // 2841  ld (0xad14),a
  regs.a = regs.inc8(regs.a);
  m.step(0x2845, 4); // 2844  inc a
  mem.write8(0xad11, regs.a);
  m.step(0x2848, 13); // 2845  ld (0xad11),a

  regs.xor(regs.a);
  m.step(0x2849, 4); // 2848  xor a
  mem.write8(0xa980, regs.a);
  m.step(0x284c, 13); // 2849  ld (0xa980),a
  mem.write8(0xa9ce, regs.a);
  m.step(0x284f, 13); // 284c  ld (0xa9ce),a
  mem.write8(0xa9cf, regs.a);
  m.step(0x2852, 13); // 284f  ld (0xa9cf),a

  m.push16(0x2855);
  m.step(0x4b67, 17); // 2852  call 0x4b67
  m.call(0x4b67);

  regs.hl = 0xaa80;
  m.step(0x2858, 10); // 2855  ld hl,0xaa80
  regs.de = 0xaa81;
  m.step(0x285b, 10); // 2858  ld de,0xaa81
  mem.write8(regs.hl, 0x00);
  m.step(0x285d, 10); // 285b  ld (hl),0x00
  regs.bc = 0x005f;
  m.step(0x2860, 10); // 285d  ld bc,0x005f
  m.ldirAt(0x2860, 0x2862); // 2860  ldir -- clear 0xAA80-0xAADF

  regs.hl = 0xa800;
  m.step(0x2865, 10); // 2862  ld hl,0xa800
  regs.de = 0xa801;
  m.step(0x2868, 10); // 2865  ld de,0xa801
  mem.write8(regs.hl, 0x00);
  m.step(0x286a, 10); // 2868  ld (hl),0x00
  regs.bc = 0x017f;
  m.step(0x286d, 10); // 286a  ld bc,0x017f
  m.ldirAt(0x286d, 0x286f); // 286d  ldir -- clear 0xA800-0xA97F

  regs.a = 0x02;
  m.step(0x2871, 7); // 286f  ld a,0x02

  m.push16(0x2874);
  m.step(0x0f7b, 17); // 2871  call 0x0f7b
  m.call(0x0f7b);

  regs.a = mem.read8(0xa9d3);
  m.step(0x2877, 13); // 2874  ld a,(0xa9d3)
  mem.write8(0xad1a, regs.a);
  m.step(0x287a, 13); // 2877  ld (0xad1a),a
  mem.write8(0xad2a, regs.a);
  m.step(0x287d, 13); // 287a  ld (0xad2a),a

  regs.c = 0x00;
  m.step(0x287f, 7); // 287d  ld c,0x00 -- 256 passes
  regs.hl = 0x3310;
  m.step(0x2882, 10); // 287f  ld hl,0x3310
  regs.a = mem.read8(0xa9ab);
  m.step(0x2885, 13); // 2882  ld a,(0xa9ab)

  for (;;) {
    regs.sub(mem.read8(regs.hl));
    m.step(0x2886, 7); // 2885  sub (hl)
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x2887, 6); // 2886  inc hl
    regs.c = regs.dec8(regs.c);
    m.step(0x2888, 4); // 2887  dec c -- the flags the jr below reads
    if (regs.fNZ) {
      m.step(0x2885, 12); // 2888  jr nz,0x2885 taken
      continue;
    }
    m.step(0x288a, 7); // 2888  jr nz not taken
    break;
  }

  regs.xor(0x90);
  m.step(0x288c, 7); // 288a  xor 0x90
  mem.write8(0xa9ab, regs.a);
  m.step(0x288f, 13); // 288c  ld (0xa9ab),a

  regs.hl = 0xac74;
  m.step(0x2892, 10); // 288f  ld hl,0xac74
  regs.b = 0x10;
  m.step(0x2894, 7); // 2892  ld b,0x10

  for (;;) {
    mem.write8(regs.hl, 0x80);
    m.step(0x2896, 10); // 2894  ld (hl),0x80
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x2897, 6); // 2896  inc hl
    if (regs.djnz() !== 0) {
      m.step(0x2894, 13); // djnz taken
      continue;
    }
    m.step(0x2899, 8); // djnz not taken
    break;
  }

  regs.a = 0x5a;
  m.step(0x289b, 7); // 2899  ld a,0x5a
  mem.write8(0xa9eb, regs.a);
  m.step(0x289e, 13); // 289b  ld (0xa9eb),a

  m.step(0x0f1a, 10); // 289e  jp 0x0f1a -- TAIL JUMP
  return m.call(0x0f1a);
}
