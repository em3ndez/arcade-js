// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_3bec  (ROM 0x3bec-0x3cc0) — paints a difficulty-selected status screen and
 * runs a count-down animation loop.
 *
 * Derives a count into 0x800a: seeds it 0x05, then +5 if (0x8081)==0x04 and again
 * +5 if (0x8082)==0x03, so it lands on 0x05 / 0x0A / 0x0F. That count then SELECTS
 * one of three text pointers per painted row: an IX chosen by `cp 0x0f`/`cp 0x0a`
 * (0x4a2e/0x4a21/0x4a14 for row one, 0x4a55/0x4a48/0x4a3b for row two), each drawn
 * via 0x3dea after positioning fields 0x8055/0x8058/0x8059; a fixed third row
 * (0x4a07) and two 0x3e1d colour draws follow. Finally it loops N=count times over
 * 0x4c6f / 0x4689(delay bc=0x10) / 0x3e13 / 0x4bff, decrementing 0x800a to 0 — the
 * `jr nz` back-edge reads `dec a`'s Z (the intervening `ld (0x800a),a` is
 * flag-neutral). Ends on a real `ret`.
 *
 *   3bec  3e 05        ld   a,0x05
 *   3bee  32 0a 80     ld   (0x800a),a
 *   3bf1  3a 81 80     ld   a,(0x8081)
 *   3bf4  fe 04        cp   0x04
 *   3bf6  20 08        jr   nz,0x3c00
 *   3bf8  3a 0a 80     ld   a,(0x800a)
 *   3bfb  c6 05        add  a,0x05
 *   3bfd  32 0a 80     ld   (0x800a),a
 * loc_3c00:
 *   3c00  3a 82 80     ld   a,(0x8082)
 *   3c03  fe 03        cp   0x03
 *   3c05  20 08        jr   nz,0x3c0f
 *   3c07  3a 0a 80     ld   a,(0x800a)
 *   3c0a  c6 05        add  a,0x05
 *   3c0c  32 0a 80     ld   (0x800a),a
 * loc_3c0f:
 *   3c0f  cd c1 3c     call 0x3cc1
 *   3c12  3e 0f        ld   a,0x0f
 *   3c14  32 58 80     ld   (0x8058),a
 *   3c17  3e 0b        ld   a,0x0b
 *   3c19  32 59 80     ld   (0x8059),a
 *   3c1c  cd ae 3d     call 0x3dae
 *   3c1f  cd c9 3d     call 0x3dc9
 *   3c22  3e 0c        ld   a,0x0c
 *   3c24  32 55 80     ld   (0x8055),a
 *   3c27  3a 0a 80     ld   a,(0x800a)
 *   3c2a  fe 0f        cp   0x0f
 *   3c2c  28 10        jr   z,0x3c3e
 *   3c2e  fe 0a        cp   0x0a
 *   3c30  28 06        jr   z,0x3c38
 *   3c32  dd 21 14 4a  ld   ix,0x4a14
 *   3c36  18 0a        jr   0x3c42
 * loc_3c38:
 *   3c38  dd 21 21 4a  ld   ix,0x4a21
 *   3c3c  18 04        jr   0x3c42
 * loc_3c3e:
 *   3c3e  dd 21 2e 4a  ld   ix,0x4a2e
 * loc_3c42:
 *   3c42  cd ea 3d     call 0x3dea
 *   3c45  3e 11        ld   a,0x11
 *   3c47  32 58 80     ld   (0x8058),a
 *   3c4a  3e 0b        ld   a,0x0b
 *   3c4c  32 59 80     ld   (0x8059),a
 *   3c4f  cd ae 3d     call 0x3dae
 *   3c52  cd c9 3d     call 0x3dc9
 *   3c55  3e 0c        ld   a,0x0c
 *   3c57  32 55 80     ld   (0x8055),a
 *   3c5a  3a 0a 80     ld   a,(0x800a)
 *   3c5d  fe 0f        cp   0x0f
 *   3c5f  ca 73 3c     jp   z,0x3c73
 *   3c62  fe 0a        cp   0x0a
 *   3c64  ca 6d 3c     jp   z,0x3c6d
 *   3c67  dd 21 3b 4a  ld   ix,0x4a3b
 *   3c6b  18 0a        jr   0x3c77
 * loc_3c6d:
 *   3c6d  dd 21 48 4a  ld   ix,0x4a48
 *   3c71  18 04        jr   0x3c77
 * loc_3c73:
 *   3c73  dd 21 55 4a  ld   ix,0x4a55
 * loc_3c77:
 *   3c77  cd ea 3d     call 0x3dea
 *   3c7a  3e 11        ld   a,0x11
 *   3c7c  0e a3        ld   c,0xa3
 *   3c7e  cd 1d 3e     call 0x3e1d
 *   3c81  3e 15        ld   a,0x15
 *   3c83  32 58 80     ld   (0x8058),a
 *   3c86  3e 09        ld   a,0x09
 *   3c88  32 59 80     ld   (0x8059),a
 *   3c8b  cd ae 3d     call 0x3dae
 *   3c8e  cd c9 3d     call 0x3dc9
 *   3c91  3e 0f        ld   a,0x0f
 *   3c93  32 55 80     ld   (0x8055),a
 *   3c96  dd 21 07 4a  ld   ix,0x4a07
 *   3c9a  cd ea 3d     call 0x3dea
 *   3c9d  3e 15        ld   a,0x15
 *   3c9f  0e a6        ld   c,0xa6
 *   3ca1  cd 1d 3e     call 0x3e1d
 * loc_3ca4:
 *   3ca4  cd 6f 4c     call 0x4c6f
 *   3ca7  01 10 00     ld   bc,0x0010
 *   3caa  cd 89 46     call 0x4689
 *   3cad  3e 0f        ld   a,0x0f
 *   3caf  cd 13 3e     call 0x3e13
 *   3cb2  3e 0f        ld   a,0x0f
 *   3cb4  cd ff 4b     call 0x4bff
 *   3cb7  3a 0a 80     ld   a,(0x800a)
 *   3cba  3d           dec  a
 *   3cbb  32 0a 80     ld   (0x800a),a
 *   3cbe  20 e4        jr   nz,0x3ca4
 *   3cc0  c9           ret
 */
export function loc_3bec(m) {
  const { regs, mem } = m;

  regs.a = 0x05;
  m.step(0x3bee, 7); // 3bec  ld a,0x05

  mem.write8(0x800a, regs.a);
  m.step(0x3bf1, 13); // 3bee  ld (0x800a),a

  regs.a = mem.read8(0x8081);
  m.step(0x3bf4, 13); // 3bf1  ld a,(0x8081)

  regs.cp(0x04);
  m.step(0x3bf6, 7); // 3bf4  cp 0x04

  // 3bf6  jr nz,0x3c00 -- skip the +5 unless (0x8081)==0x04
  if (regs.fNZ) {
    m.step(0x3c00, 12); // taken
  } else {
    m.step(0x3bf8, 7); // not taken -> fall through

    regs.a = mem.read8(0x800a);
    m.step(0x3bfb, 13); // 3bf8  ld a,(0x800a)

    regs.add(0x05);
    m.step(0x3bfd, 7); // 3bfb  add a,0x05

    mem.write8(0x800a, regs.a);
    m.step(0x3c00, 13); // 3bfd  ld (0x800a),a
  }

  // loc_3c00:
  regs.a = mem.read8(0x8082);
  m.step(0x3c03, 13); // 3c00  ld a,(0x8082)

  regs.cp(0x03);
  m.step(0x3c05, 7); // 3c03  cp 0x03

  // 3c05  jr nz,0x3c0f -- skip the +5 unless (0x8082)==0x03
  if (regs.fNZ) {
    m.step(0x3c0f, 12); // taken
  } else {
    m.step(0x3c07, 7); // not taken -> fall through

    regs.a = mem.read8(0x800a);
    m.step(0x3c0a, 13); // 3c07  ld a,(0x800a)

    regs.add(0x05);
    m.step(0x3c0c, 7); // 3c0a  add a,0x05

    mem.write8(0x800a, regs.a);
    m.step(0x3c0f, 13); // 3c0c  ld (0x800a),a
  }

  // loc_3c0f:
  m.push16(0x3c12);
  m.step(0x3cc1, 17); // 3c0f  call 0x3cc1
  m.call(0x3cc1);

  regs.a = 0x0f;
  m.step(0x3c14, 7); // 3c12  ld a,0x0f

  mem.write8(0x8058, regs.a);
  m.step(0x3c17, 13); // 3c14  ld (0x8058),a

  regs.a = 0x0b;
  m.step(0x3c19, 7); // 3c17  ld a,0x0b

  mem.write8(0x8059, regs.a);
  m.step(0x3c1c, 13); // 3c19  ld (0x8059),a

  m.push16(0x3c1f);
  m.step(0x3dae, 17); // 3c1c  call 0x3dae
  m.call(0x3dae);

  m.push16(0x3c22);
  m.step(0x3dc9, 17); // 3c1f  call 0x3dc9
  m.call(0x3dc9);

  regs.a = 0x0c;
  m.step(0x3c24, 7); // 3c22  ld a,0x0c

  mem.write8(0x8055, regs.a);
  m.step(0x3c27, 13); // 3c24  ld (0x8055),a

  regs.a = mem.read8(0x800a);
  m.step(0x3c2a, 13); // 3c27  ld a,(0x800a)

  regs.cp(0x0f);
  m.step(0x3c2c, 7); // 3c2a  cp 0x0f

  // 3c2c  jr z,0x3c3e -- row-1 text pointer, selected by the count
  if (regs.fZ) {
    m.step(0x3c3e, 12); // taken -> loc_3c3e
    regs.ix = 0x4a2e;
    m.step(0x3c42, 14); // 3c3e  ld ix,0x4a2e
  } else {
    m.step(0x3c2e, 7); // not taken

    regs.cp(0x0a);
    m.step(0x3c30, 7); // 3c2e  cp 0x0a

    // 3c30  jr z,0x3c38
    if (regs.fZ) {
      m.step(0x3c38, 12); // taken -> loc_3c38
      regs.ix = 0x4a21;
      m.step(0x3c3c, 14); // 3c38  ld ix,0x4a21
      m.step(0x3c42, 12); // 3c3c  jr 0x3c42
    } else {
      m.step(0x3c32, 7); // not taken
      regs.ix = 0x4a14;
      m.step(0x3c36, 14); // 3c32  ld ix,0x4a14
      m.step(0x3c42, 12); // 3c36  jr 0x3c42
    }
  }

  // loc_3c42:
  m.push16(0x3c45);
  m.step(0x3dea, 17); // 3c42  call 0x3dea
  m.call(0x3dea);

  regs.a = 0x11;
  m.step(0x3c47, 7); // 3c45  ld a,0x11

  mem.write8(0x8058, regs.a);
  m.step(0x3c4a, 13); // 3c47  ld (0x8058),a

  regs.a = 0x0b;
  m.step(0x3c4c, 7); // 3c4a  ld a,0x0b

  mem.write8(0x8059, regs.a);
  m.step(0x3c4f, 13); // 3c4c  ld (0x8059),a

  m.push16(0x3c52);
  m.step(0x3dae, 17); // 3c4f  call 0x3dae
  m.call(0x3dae);

  m.push16(0x3c55);
  m.step(0x3dc9, 17); // 3c52  call 0x3dc9
  m.call(0x3dc9);

  regs.a = 0x0c;
  m.step(0x3c57, 7); // 3c55  ld a,0x0c

  mem.write8(0x8055, regs.a);
  m.step(0x3c5a, 13); // 3c57  ld (0x8055),a

  regs.a = mem.read8(0x800a);
  m.step(0x3c5d, 13); // 3c5a  ld a,(0x800a)

  regs.cp(0x0f);
  m.step(0x3c5f, 7); // 3c5d  cp 0x0f

  // 3c5f  jp z,0x3c73 -- row-2 text pointer, selected by the count
  if (regs.fZ) {
    m.step(0x3c73, 10); // taken -> loc_3c73
    regs.ix = 0x4a55;
    m.step(0x3c77, 14); // 3c73  ld ix,0x4a55
  } else {
    m.step(0x3c62, 10); // not taken

    regs.cp(0x0a);
    m.step(0x3c64, 7); // 3c62  cp 0x0a

    // 3c64  jp z,0x3c6d
    if (regs.fZ) {
      m.step(0x3c6d, 10); // taken -> loc_3c6d
      regs.ix = 0x4a48;
      m.step(0x3c71, 14); // 3c6d  ld ix,0x4a48
      m.step(0x3c77, 12); // 3c71  jr 0x3c77
    } else {
      m.step(0x3c67, 10); // not taken
      regs.ix = 0x4a3b;
      m.step(0x3c6b, 14); // 3c67  ld ix,0x4a3b
      m.step(0x3c77, 12); // 3c6b  jr 0x3c77
    }
  }

  // loc_3c77:
  m.push16(0x3c7a);
  m.step(0x3dea, 17); // 3c77  call 0x3dea
  m.call(0x3dea);

  regs.a = 0x11;
  m.step(0x3c7c, 7); // 3c7a  ld a,0x11

  regs.c = 0xa3;
  m.step(0x3c7e, 7); // 3c7c  ld c,0xa3

  m.push16(0x3c81);
  m.step(0x3e1d, 17); // 3c7e  call 0x3e1d
  m.call(0x3e1d);

  regs.a = 0x15;
  m.step(0x3c83, 7); // 3c81  ld a,0x15

  mem.write8(0x8058, regs.a);
  m.step(0x3c86, 13); // 3c83  ld (0x8058),a

  regs.a = 0x09;
  m.step(0x3c88, 7); // 3c86  ld a,0x09

  mem.write8(0x8059, regs.a);
  m.step(0x3c8b, 13); // 3c88  ld (0x8059),a

  m.push16(0x3c8e);
  m.step(0x3dae, 17); // 3c8b  call 0x3dae
  m.call(0x3dae);

  m.push16(0x3c91);
  m.step(0x3dc9, 17); // 3c8e  call 0x3dc9
  m.call(0x3dc9);

  regs.a = 0x0f;
  m.step(0x3c93, 7); // 3c91  ld a,0x0f

  mem.write8(0x8055, regs.a);
  m.step(0x3c96, 13); // 3c93  ld (0x8055),a

  regs.ix = 0x4a07;
  m.step(0x3c9a, 14); // 3c96  ld ix,0x4a07 (fixed third row)

  m.push16(0x3c9d);
  m.step(0x3dea, 17); // 3c9a  call 0x3dea
  m.call(0x3dea);

  regs.a = 0x15;
  m.step(0x3c9f, 7); // 3c9d  ld a,0x15

  regs.c = 0xa6;
  m.step(0x3ca1, 7); // 3c9f  ld c,0xa6

  m.push16(0x3ca4);
  m.step(0x3e1d, 17); // 3ca1  call 0x3e1d
  m.call(0x3e1d);

  // loc_3ca4: count-down animation loop, N = (0x800a) iterations.
  for (;;) {
    m.push16(0x3ca7);
    m.step(0x4c6f, 17); // 3ca4  call 0x4c6f
    m.call(0x4c6f);

    regs.bc = 0x0010;
    m.step(0x3caa, 10); // 3ca7  ld bc,0x0010

    m.push16(0x3cad);
    m.step(0x4689, 17); // 3caa  call 0x4689 (delay)
    m.call(0x4689);

    regs.a = 0x0f;
    m.step(0x3caf, 7); // 3cad  ld a,0x0f

    m.push16(0x3cb2);
    m.step(0x3e13, 17); // 3caf  call 0x3e13
    m.call(0x3e13);

    regs.a = 0x0f;
    m.step(0x3cb4, 7); // 3cb2  ld a,0x0f

    m.push16(0x3cb7);
    m.step(0x4bff, 17); // 3cb4  call 0x4bff
    m.call(0x4bff);

    regs.a = mem.read8(0x800a);
    m.step(0x3cba, 13); // 3cb7  ld a,(0x800a)

    regs.a = regs.dec8(regs.a);
    m.step(0x3cbb, 4); // 3cba  dec a

    mem.write8(0x800a, regs.a);
    m.step(0x3cbe, 13); // 3cbb  ld (0x800a),a -- flag-neutral, preserves dec's Z

    // 3cbe  jr nz,0x3ca4 -- loop while the count is non-zero
    if (regs.fNZ) {
      m.step(0x3ca4, 12); // taken
    } else {
      m.step(0x3cc0, 7); // not taken -> fall to ret
      break;
    }
  }

  m.ret(); // 3cc0  ret
}
