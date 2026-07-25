// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_3a6f  (ROM 0x3a6f–0x3b80) — the HUD / status-row builder run at the top of
 * a play frame. It calls a chain of setup helpers, then lays down several tilemap
 * sprite/status records: for each it points IX at the record cell, seeds a
 * value, sets the (0x8055/0x8058/0x8059) tile+position scratch registers and
 * calls the record renderers (0x3dae/0x3dc9/0x3dea/0x3e1d). Two of the records
 * (from 0x804c and 0x804d) pick their tile via `and a`/`jr z`; a third patches
 * cell 0x918e to 0x24 when (0x804c) counts down to 1. It closes with a 0x1e-count
 * delay loop that calls 0x3e13 + 0x4bff each pass, ticking down 0x800a to 0.
 *
 *   3a6f  cd 44 4b     call 0x4b44
 *   3a72  cd f4 46     call 0x46f4
 *   3a75  cd 2c 47     call 0x472c
 *   3a78  3e 01        ld   a,0x01
 *   3a7a  0e 02        ld   c,0x02
 *   3a7c  cd 1d 3e     call 0x3e1d
 *   3a7f  cd 49 3d     call 0x3d49
 *   3a82  cd 8a 3d     call 0x3d8a
 *   3a85  cd 2a 49     call 0x492a
 *   3a88  cd 85 47     call 0x4785
 *   3a8b  cd a1 47     call 0x47a1
 *   3a8e  dd 21 8c 92  ld   ix,0x928c
 *   3a92  dd 36 00 01  ld   (ix+0x00),0x01
 *   3a96  3e 0c        ld   a,0x0c
 *   3a98  32 58 80     ld   (0x8058),a
 *   3a9b  3e 0d        ld   a,0x0d
 *   3a9d  32 59 80     ld   (0x8059),a
 *   3aa0  cd ae 3d     call 0x3dae
 *   3aa3  cd c9 3d     call 0x3dc9
 *   3aa6  3e 06        ld   a,0x06
 *   3aa8  32 55 80     ld   (0x8055),a
 *   3aab  dd 21 b0 49  ld   ix,0x49b0
 *   3aaf  cd ea 3d     call 0x3dea
 *   3ab2  3e 0c        ld   a,0x0c
 *   3ab4  0e 07        ld   c,0x07
 *   3ab6  cd 1d 3e     call 0x3e1d
 *   3ab9  dd 21 8e 92  ld   ix,0x928e
 *   3abd  3a 4c 80     ld   a,(0x804c)
 *   3ac0  dd 77 00     ld   (ix+0x00),a
 *   3ac3  3e 0e        ld   a,0x0e
 *   3ac5  32 58 80     ld   (0x8058),a
 *   3ac8  3e 0c        ld   a,0x0c
 *   3aca  32 59 80     ld   (0x8059),a
 *   3acd  cd ae 3d     call 0x3dae
 *   3ad0  cd c9 3d     call 0x3dc9
 *   3ad3  3a 4c 80     ld   a,(0x804c)
 *   3ad6  a7           and  a
 *   3ad7  28 08        jr   z,0x3ae1
 *   3ad9  dd 21 6c 49  ld   ix,0x496c
 *   3add  3e 07        ld   a,0x07
 *   3adf  18 06        jr   0x3ae7
 * loc_3ae1:
 *   3ae1  dd 21 ae 49  ld   ix,0x49ae
 *   3ae5  3e 09        ld   a,0x09
 * loc_3ae7:
 *   3ae7  32 55 80     ld   (0x8055),a
 *   3aea  cd ea 3d     call 0x3dea
 *   3aed  3a 4c 80     ld   a,(0x804c)
 *   3af0  3d           dec  a
 *   3af1  20 08        jr   nz,0x3afb
 *   3af3  dd 21 8e 91  ld   ix,0x918e
 *   3af7  dd 36 00 24  ld   (ix+0x00),0x24
 * loc_3afb:
 *   3afb  3e 0e        ld   a,0x0e
 *   3afd  0e 07        ld   c,0x07
 *   3aff  cd 1d 3e     call 0x3e1d
 *   3b02  dd 21 92 92  ld   ix,0x9292
 *   3b06  dd 36 00 02  ld   (ix+0x00),0x02
 *   3b0a  3e 12        ld   a,0x12
 *   3b0c  32 58 80     ld   (0x8058),a
 *   3b0f  3e 0c        ld   a,0x0c
 *   3b11  32 59 80     ld   (0x8059),a
 *   3b14  cd ae 3d     call 0x3dae
 *   3b17  cd c9 3d     call 0x3dc9
 *   3b1a  3e 07        ld   a,0x07
 *   3b1c  32 55 80     ld   (0x8055),a
 *   3b1f  dd 21 b1 49  ld   ix,0x49b1
 *   3b23  cd ea 3d     call 0x3dea
 *   3b26  3e 12        ld   a,0x12
 *   3b28  0e 03        ld   c,0x03
 *   3b2a  cd 1d 3e     call 0x3e1d
 *   3b2d  dd 21 94 92  ld   ix,0x9294
 *   3b31  3a 4d 80     ld   a,(0x804d)
 *   3b34  dd 77 00     ld   (ix+0x00),a
 *   3b37  3e 14        ld   a,0x14
 *   3b39  32 58 80     ld   (0x8058),a
 *   3b3c  3e 0c        ld   a,0x0c
 *   3b3e  32 59 80     ld   (0x8059),a
 *   3b41  cd ae 3d     call 0x3dae
 *   3b44  cd c9 3d     call 0x3dc9
 *   3b47  3a 4d 80     ld   a,(0x804d)
 *   3b4a  a7           and  a
 *   3b4b  28 08        jr   z,0x3b55
 *   3b4d  dd 21 6c 49  ld   ix,0x496c
 *   3b51  3e 07        ld   a,0x07
 *   3b53  18 06        jr   0x3b5b
 * loc_3b55:
 *   3b55  dd 21 ae 49  ld   ix,0x49ae
 *   3b59  3e 09        ld   a,0x09
 * loc_3b5b:
 *   3b5b  32 55 80     ld   (0x8055),a
 *   3b5e  cd ea 3d     call 0x3dea
 *   3b61  3e 14        ld   a,0x14
 *   3b63  0e 03        ld   c,0x03
 *   3b65  cd 1d 3e     call 0x3e1d
 *   3b68  3e 1e        ld   a,0x1e
 *   3b6a  32 0a 80     ld   (0x800a),a
 * loc_3b6d:
 *   3b6d  3e 06        ld   a,0x06
 *   3b6f  cd 13 3e     call 0x3e13
 *   3b72  3e 0f        ld   a,0x0f
 *   3b74  cd ff 4b     call 0x4bff
 *   3b77  3a 0a 80     ld   a,(0x800a)
 *   3b7a  3d           dec  a
 *   3b7b  32 0a 80     ld   (0x800a),a
 *   3b7e  20 ed        jr   nz,0x3b6d
 *   3b80  c9           ret
 */
export function loc_3a6f(m) {
  const { regs, mem } = m;

  m.push16(0x3a72);
  m.step(0x4b44, 17); // 3a6f  call 0x4b44
  m.call(0x4b44);

  m.push16(0x3a75);
  m.step(0x46f4, 17); // 3a72  call 0x46f4
  m.call(0x46f4);

  m.push16(0x3a78);
  m.step(0x472c, 17); // 3a75  call 0x472c
  m.call(0x472c);

  regs.a = 0x01;
  m.step(0x3a7a, 7); // 3a78  ld a,0x01
  regs.c = 0x02;
  m.step(0x3a7c, 7); // 3a7a  ld c,0x02

  m.push16(0x3a7f);
  m.step(0x3e1d, 17); // 3a7c  call 0x3e1d
  m.call(0x3e1d);

  m.push16(0x3a82);
  m.step(0x3d49, 17); // 3a7f  call 0x3d49
  m.call(0x3d49);

  m.push16(0x3a85);
  m.step(0x3d8a, 17); // 3a82  call 0x3d8a
  m.call(0x3d8a);

  m.push16(0x3a88);
  m.step(0x492a, 17); // 3a85  call 0x492a
  m.call(0x492a);

  m.push16(0x3a8b);
  m.step(0x4785, 17); // 3a88  call 0x4785
  m.call(0x4785);

  m.push16(0x3a8e);
  m.step(0x47a1, 17); // 3a8b  call 0x47a1
  m.call(0x47a1);

  regs.ix = 0x928c;
  m.step(0x3a92, 14); // 3a8e  ld ix,0x928c
  mem.write8((regs.ix + 0x00) & 0xffff, 0x01);
  m.step(0x3a96, 19); // 3a92  ld (ix+0x00),0x01
  regs.a = 0x0c;
  m.step(0x3a98, 7); // 3a96  ld a,0x0c
  mem.write8(0x8058, regs.a);
  m.step(0x3a9b, 13); // 3a98  ld (0x8058),a
  regs.a = 0x0d;
  m.step(0x3a9d, 7); // 3a9b  ld a,0x0d
  mem.write8(0x8059, regs.a);
  m.step(0x3aa0, 13); // 3a9d  ld (0x8059),a

  m.push16(0x3aa3);
  m.step(0x3dae, 17); // 3aa0  call 0x3dae
  m.call(0x3dae);

  m.push16(0x3aa6);
  m.step(0x3dc9, 17); // 3aa3  call 0x3dc9
  m.call(0x3dc9);

  regs.a = 0x06;
  m.step(0x3aa8, 7); // 3aa6  ld a,0x06
  mem.write8(0x8055, regs.a);
  m.step(0x3aab, 13); // 3aa8  ld (0x8055),a
  regs.ix = 0x49b0;
  m.step(0x3aaf, 14); // 3aab  ld ix,0x49b0

  m.push16(0x3ab2);
  m.step(0x3dea, 17); // 3aaf  call 0x3dea
  m.call(0x3dea);

  regs.a = 0x0c;
  m.step(0x3ab4, 7); // 3ab2  ld a,0x0c
  regs.c = 0x07;
  m.step(0x3ab6, 7); // 3ab4  ld c,0x07

  m.push16(0x3ab9);
  m.step(0x3e1d, 17); // 3ab6  call 0x3e1d
  m.call(0x3e1d);

  regs.ix = 0x928e;
  m.step(0x3abd, 14); // 3ab9  ld ix,0x928e
  regs.a = mem.read8(0x804c);
  m.step(0x3ac0, 13); // 3abd  ld a,(0x804c)
  mem.write8((regs.ix + 0x00) & 0xffff, regs.a);
  m.step(0x3ac3, 19); // 3ac0  ld (ix+0x00),a
  regs.a = 0x0e;
  m.step(0x3ac5, 7); // 3ac3  ld a,0x0e
  mem.write8(0x8058, regs.a);
  m.step(0x3ac8, 13); // 3ac5  ld (0x8058),a
  regs.a = 0x0c;
  m.step(0x3aca, 7); // 3ac8  ld a,0x0c
  mem.write8(0x8059, regs.a);
  m.step(0x3acd, 13); // 3aca  ld (0x8059),a

  m.push16(0x3ad0);
  m.step(0x3dae, 17); // 3acd  call 0x3dae
  m.call(0x3dae);

  m.push16(0x3ad3);
  m.step(0x3dc9, 17); // 3ad0  call 0x3dc9
  m.call(0x3dc9);

  regs.a = mem.read8(0x804c);
  m.step(0x3ad6, 13); // 3ad3  ld a,(0x804c)
  regs.and(regs.a);
  m.step(0x3ad7, 4); // 3ad6  and a
  if (regs.fZ) {
    m.step(0x3ae1, 12); // 3ad7  jr z,0x3ae1 taken
    // loc_3ae1
    regs.ix = 0x49ae;
    m.step(0x3ae5, 14); // 3ae1  ld ix,0x49ae
    regs.a = 0x09;
    m.step(0x3ae7, 7); // 3ae5  ld a,0x09
  } else {
    m.step(0x3ad9, 7); // 3ad7  jr z,0x3ae1 not taken
    regs.ix = 0x496c;
    m.step(0x3add, 14); // 3ad9  ld ix,0x496c
    regs.a = 0x07;
    m.step(0x3adf, 7); // 3add  ld a,0x07
    m.step(0x3ae7, 12); // 3adf  jr 0x3ae7
  }

  // loc_3ae7
  mem.write8(0x8055, regs.a);
  m.step(0x3aea, 13); // 3ae7  ld (0x8055),a

  m.push16(0x3aed);
  m.step(0x3dea, 17); // 3aea  call 0x3dea
  m.call(0x3dea);

  regs.a = mem.read8(0x804c);
  m.step(0x3af0, 13); // 3aed  ld a,(0x804c)
  regs.a = regs.dec8(regs.a);
  m.step(0x3af1, 4); // 3af0  dec a
  if (regs.fNZ) {
    m.step(0x3afb, 12); // 3af1  jr nz,0x3afb taken
  } else {
    m.step(0x3af3, 7); // 3af1  jr nz,0x3afb not taken
    regs.ix = 0x918e;
    m.step(0x3af7, 14); // 3af3  ld ix,0x918e
    mem.write8((regs.ix + 0x00) & 0xffff, 0x24);
    m.step(0x3afb, 19); // 3af7  ld (ix+0x00),0x24
  }

  // loc_3afb
  regs.a = 0x0e;
  m.step(0x3afd, 7); // 3afb  ld a,0x0e
  regs.c = 0x07;
  m.step(0x3aff, 7); // 3afd  ld c,0x07

  m.push16(0x3b02);
  m.step(0x3e1d, 17); // 3aff  call 0x3e1d
  m.call(0x3e1d);

  regs.ix = 0x9292;
  m.step(0x3b06, 14); // 3b02  ld ix,0x9292
  mem.write8((regs.ix + 0x00) & 0xffff, 0x02);
  m.step(0x3b0a, 19); // 3b06  ld (ix+0x00),0x02
  regs.a = 0x12;
  m.step(0x3b0c, 7); // 3b0a  ld a,0x12
  mem.write8(0x8058, regs.a);
  m.step(0x3b0f, 13); // 3b0c  ld (0x8058),a
  regs.a = 0x0c;
  m.step(0x3b11, 7); // 3b0f  ld a,0x0c
  mem.write8(0x8059, regs.a);
  m.step(0x3b14, 13); // 3b11  ld (0x8059),a

  m.push16(0x3b17);
  m.step(0x3dae, 17); // 3b14  call 0x3dae
  m.call(0x3dae);

  m.push16(0x3b1a);
  m.step(0x3dc9, 17); // 3b17  call 0x3dc9
  m.call(0x3dc9);

  regs.a = 0x07;
  m.step(0x3b1c, 7); // 3b1a  ld a,0x07
  mem.write8(0x8055, regs.a);
  m.step(0x3b1f, 13); // 3b1c  ld (0x8055),a
  regs.ix = 0x49b1;
  m.step(0x3b23, 14); // 3b1f  ld ix,0x49b1

  m.push16(0x3b26);
  m.step(0x3dea, 17); // 3b23  call 0x3dea
  m.call(0x3dea);

  regs.a = 0x12;
  m.step(0x3b28, 7); // 3b26  ld a,0x12
  regs.c = 0x03;
  m.step(0x3b2a, 7); // 3b28  ld c,0x03

  m.push16(0x3b2d);
  m.step(0x3e1d, 17); // 3b2a  call 0x3e1d
  m.call(0x3e1d);

  regs.ix = 0x9294;
  m.step(0x3b31, 14); // 3b2d  ld ix,0x9294
  regs.a = mem.read8(0x804d);
  m.step(0x3b34, 13); // 3b31  ld a,(0x804d)
  mem.write8((regs.ix + 0x00) & 0xffff, regs.a);
  m.step(0x3b37, 19); // 3b34  ld (ix+0x00),a
  regs.a = 0x14;
  m.step(0x3b39, 7); // 3b37  ld a,0x14
  mem.write8(0x8058, regs.a);
  m.step(0x3b3c, 13); // 3b39  ld (0x8058),a
  regs.a = 0x0c;
  m.step(0x3b3e, 7); // 3b3c  ld a,0x0c
  mem.write8(0x8059, regs.a);
  m.step(0x3b41, 13); // 3b3e  ld (0x8059),a

  m.push16(0x3b44);
  m.step(0x3dae, 17); // 3b41  call 0x3dae
  m.call(0x3dae);

  m.push16(0x3b47);
  m.step(0x3dc9, 17); // 3b44  call 0x3dc9
  m.call(0x3dc9);

  regs.a = mem.read8(0x804d);
  m.step(0x3b4a, 13); // 3b47  ld a,(0x804d)
  regs.and(regs.a);
  m.step(0x3b4b, 4); // 3b4a  and a
  if (regs.fZ) {
    m.step(0x3b55, 12); // 3b4b  jr z,0x3b55 taken
    // loc_3b55
    regs.ix = 0x49ae;
    m.step(0x3b59, 14); // 3b55  ld ix,0x49ae
    regs.a = 0x09;
    m.step(0x3b5b, 7); // 3b59  ld a,0x09
  } else {
    m.step(0x3b4d, 7); // 3b4b  jr z,0x3b55 not taken
    regs.ix = 0x496c;
    m.step(0x3b51, 14); // 3b4d  ld ix,0x496c
    regs.a = 0x07;
    m.step(0x3b53, 7); // 3b51  ld a,0x07
    m.step(0x3b5b, 12); // 3b53  jr 0x3b5b
  }

  // loc_3b5b
  mem.write8(0x8055, regs.a);
  m.step(0x3b5e, 13); // 3b5b  ld (0x8055),a

  m.push16(0x3b61);
  m.step(0x3dea, 17); // 3b5e  call 0x3dea
  m.call(0x3dea);

  regs.a = 0x14;
  m.step(0x3b63, 7); // 3b61  ld a,0x14
  regs.c = 0x03;
  m.step(0x3b65, 7); // 3b63  ld c,0x03

  m.push16(0x3b68);
  m.step(0x3e1d, 17); // 3b65  call 0x3e1d
  m.call(0x3e1d);

  regs.a = 0x1e;
  m.step(0x3b6a, 7); // 3b68  ld a,0x1e
  mem.write8(0x800a, regs.a);
  m.step(0x3b6d, 13); // 3b6a  ld (0x800a),a

  // loc_3b6d -- delay/refresh loop, counting 0x800a down to 0
  for (;;) {
    regs.a = 0x06;
    m.step(0x3b6f, 7); // 3b6d  ld a,0x06

    m.push16(0x3b72);
    m.step(0x3e13, 17); // 3b6f  call 0x3e13
    m.call(0x3e13);

    regs.a = 0x0f;
    m.step(0x3b74, 7); // 3b72  ld a,0x0f

    m.push16(0x3b77);
    m.step(0x4bff, 17); // 3b74  call 0x4bff
    m.call(0x4bff);

    regs.a = mem.read8(0x800a);
    m.step(0x3b7a, 13); // 3b77  ld a,(0x800a)
    regs.a = regs.dec8(regs.a);
    m.step(0x3b7b, 4); // 3b7a  dec a
    mem.write8(0x800a, regs.a);
    m.step(0x3b7e, 13); // 3b7b  ld (0x800a),a
    if (regs.fNZ) {
      m.step(0x3b6d, 12); // 3b7e  jr nz,0x3b6d taken -> loop
      continue;
    }
    m.step(0x3b80, 7); // 3b7e  jr nz,0x3b6d not taken -> fall through
    break;
  }

  m.ret(); // 3b80  ret
}
