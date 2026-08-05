// SPDX-License-Identifier: GPL-3.0-only

// loc_0dd7  (ROM 0x0dd7-0x0e6f, Time Pilot)
export function loc_0dd7(m) {
  const { regs, mem } = m;

  regs.de = 0xa463;
  m.step(0x0dda, 10); // 0dd7  ld de,0xa463
  regs.cp(0x64);
  m.step(0x0ddc, 7); // 0dda  cp 0x64

  if (regs.fC) {
    m.step(0x0de0, 12); // 0ddc  jr c,0x0de0 (taken)
  } else {
    m.step(0x0dde, 7); // 0ddc  jr c,0x0de0 (not taken)
    regs.a = 0x63;
    m.step(0x0de0, 7); // 0dde  ld a,0x63
  }

  regs.exx();
  m.step(0x0de1, 4); // 0de0  exx
  regs.b = 0x00;
  m.step(0x0de3, 7); // 0de1  ld b,0x00

  for (;;) {
    regs.sub(0x1e);
    m.step(0x0de5, 7); // 0de3  sub 0x1e
    if (regs.fC) {
      m.step(0x0dea, 12); // 0de5  jr c,0x0dea (taken)
      break;
    }
    m.step(0x0de7, 7); // 0de5  jr c,0x0dea (not taken)
    regs.b = regs.inc8(regs.b);
    m.step(0x0de8, 4); // 0de7  inc b
    m.step(0x0de3, 12); // 0de8  jr 0x0de3
  }

  regs.add(0x1e);
  m.step(0x0dec, 7); // 0dea  add a,0x1e
  regs.c = 0x00;
  m.step(0x0dee, 7); // 0dec  ld c,0x00

  for (;;) {
    regs.sub(0x0a);
    m.step(0x0df0, 7); // 0dee  sub 0x0a
    if (regs.fC) {
      m.step(0x0df5, 12); // 0df0  jr c,0x0df5 (taken)
      break;
    }
    m.step(0x0df2, 7); // 0df0  jr c,0x0df5 (not taken)
    regs.c = regs.inc8(regs.c);
    m.step(0x0df3, 4); // 0df2  inc c
    m.step(0x0dee, 12); // 0df3  jr 0x0dee
  }

  regs.add(0x0a);
  m.step(0x0df7, 7); // 0df5  add a,0x0a
  regs.d = 0x00;
  m.step(0x0df9, 7); // 0df7  ld d,0x00

  for (;;) {
    regs.sub(0x05);
    m.step(0x0dfb, 7); // 0df9  sub 0x05
    if (regs.fC) {
      m.step(0x0e00, 12); // 0dfb  jr c,0x0e00 (taken)
      break;
    }
    m.step(0x0dfd, 7); // 0dfb  jr c,0x0e00 (not taken)
    regs.d = regs.inc8(regs.d);
    m.step(0x0dfe, 4); // 0dfd  inc d
    m.step(0x0df9, 12); // 0dfe  jr 0x0df9
  }

  regs.add(0x05);
  m.step(0x0e02, 7); // 0e00  add a,0x05
  regs.e = regs.a;
  m.step(0x0e03, 4); // 0e02  ld e,a
  regs.exx();
  m.step(0x0e04, 4); // 0e03  exx

  regs.exx();
  m.step(0x0e05, 4); // 0e04  exx
  regs.a = regs.e;
  m.step(0x0e06, 4); // 0e05  ld a,e
  regs.exx();
  m.step(0x0e07, 4); // 0e06  exx
  regs.and(regs.a);
  m.step(0x0e08, 4); // 0e07  and a

  if (regs.fZ) {
    m.step(0x0e16, 12); // 0e08  jr z,0x0e16 (taken)
  } else {
    m.step(0x0e0a, 7); // 0e08  jr z,0x0e16 (not taken)
    regs.b = 0x01;
    m.step(0x0e0c, 7); // 0e0a  ld b,0x01
    regs.c = 0x13;
    m.step(0x0e0e, 7); // 0e0c  ld c,0x13
    for (;;) {
      regs.exAf();
      m.step(0x0e0f, 4); // 0e0e  ex af,af'
      m.push16(0x0e12);
      m.step(0x0e8d, 17); // 0e0f  call 0x0e8d
      m.call(0x0e8d);
      regs.exAf();
      m.step(0x0e13, 4); // 0e12  ex af,af'
      regs.a = regs.dec8(regs.a);
      m.step(0x0e14, 4); // 0e13  dec a
      if (regs.fNZ) {
        m.step(0x0e0e, 12); // 0e14  jr nz,0x0e0e (taken)
        continue;
      }
      m.step(0x0e16, 7); // 0e14  jr nz,0x0e0e (not taken)
      break;
    }
  }

  regs.exx();
  m.step(0x0e17, 4); // 0e16  exx
  regs.a = regs.d;
  m.step(0x0e18, 4); // 0e17  ld a,d
  regs.exx();
  m.step(0x0e19, 4); // 0e18  exx
  regs.and(regs.a);
  m.step(0x0e1a, 4); // 0e19  and a

  if (regs.fZ) {
    m.step(0x0e28, 12); // 0e1a  jr z,0x0e28 (taken)
  } else {
    m.step(0x0e1c, 7); // 0e1a  jr z,0x0e28 (not taken)
    regs.b = 0x32;
    m.step(0x0e1e, 7); // 0e1c  ld b,0x32
    regs.c = 0x11;
    m.step(0x0e20, 7); // 0e1e  ld c,0x11
    for (;;) {
      regs.exAf();
      m.step(0x0e21, 4); // 0e20  ex af,af'
      m.push16(0x0e24);
      m.step(0x0e9c, 17); // 0e21  call 0x0e9c
      m.call(0x0e9c);
      regs.exAf();
      m.step(0x0e25, 4); // 0e24  ex af,af'
      regs.a = regs.dec8(regs.a);
      m.step(0x0e26, 4); // 0e25  dec a
      if (regs.fNZ) {
        m.step(0x0e20, 12); // 0e26  jr nz,0x0e20 (taken)
        continue;
      }
      m.step(0x0e28, 7); // 0e26  jr nz,0x0e20 (not taken)
      break;
    }
  }

  regs.exx();
  m.step(0x0e29, 4); // 0e28  exx
  regs.a = regs.c;
  m.step(0x0e2a, 4); // 0e29  ld a,c
  regs.exx();
  m.step(0x0e2b, 4); // 0e2a  exx
  regs.and(regs.a);
  m.step(0x0e2c, 4); // 0e2b  and a

  if (regs.fZ) {
    m.step(0x0e3a, 12); // 0e2c  jr z,0x0e3a (taken)
  } else {
    m.step(0x0e2e, 7); // 0e2c  jr z,0x0e3a (not taken)
    regs.b = 0xce;
    m.step(0x0e30, 7); // 0e2e  ld b,0xce
    regs.c = 0x16;
    m.step(0x0e32, 7); // 0e30  ld c,0x16
    for (;;) {
      regs.exAf();
      m.step(0x0e33, 4); // 0e32  ex af,af'
      m.push16(0x0e36);
      m.step(0x0e70, 17); // 0e33  call 0x0e70
      m.call(0x0e70);
      regs.exAf();
      m.step(0x0e37, 4); // 0e36  ex af,af'
      regs.a = regs.dec8(regs.a);
      m.step(0x0e38, 4); // 0e37  dec a
      if (regs.fNZ) {
        m.step(0x0e32, 12); // 0e38  jr nz,0x0e32 (taken)
        continue;
      }
      m.step(0x0e3a, 7); // 0e38  jr nz,0x0e32 (not taken)
      break;
    }
  }

  regs.exx();
  m.step(0x0e3b, 4); // 0e3a  exx
  regs.a = regs.b;
  m.step(0x0e3c, 4); // 0e3b  ld a,b
  regs.exx();
  m.step(0x0e3d, 4); // 0e3c  exx
  regs.and(regs.a);
  m.step(0x0e3e, 4); // 0e3d  and a

  if (regs.fZ) {
    m.step(0x0e4c, 12); // 0e3e  jr z,0x0e4c (taken)
  } else {
    m.step(0x0e40, 7); // 0e3e  jr z,0x0e4c (not taken)
    regs.b = 0x23;
    m.step(0x0e42, 7); // 0e40  ld b,0x23
    regs.c = 0x11;
    m.step(0x0e44, 7); // 0e42  ld c,0x11
    for (;;) {
      regs.exAf();
      m.step(0x0e45, 4); // 0e44  ex af,af'
      m.push16(0x0e48);
      m.step(0x0e70, 17); // 0e45  call 0x0e70
      m.call(0x0e70);
      regs.exAf();
      m.step(0x0e49, 4); // 0e48  ex af,af'
      regs.a = regs.dec8(regs.a);
      m.step(0x0e4a, 4); // 0e49  dec a
      if (regs.fNZ) {
        m.step(0x0e44, 12); // 0e4a  jr nz,0x0e44 (taken)
        continue;
      }
      m.step(0x0e4c, 7); // 0e4a  jr nz,0x0e44 (not taken)
      break;
    }
  }

  regs.bc = 0xf110;
  m.step(0x0e4f, 10); // 0e4c  ld bc,0xf110

  for (;;) {
    regs.hl = 0x59dd;
    m.step(0x0e52, 10); // 0e4f  ld hl,0x59dd
    regs.addHl(regs.de);
    m.step(0x0e53, 11); // 0e52  add hl,de -- carry once DE reaches 0xa623
    if (regs.fC) {
      m.step(0x0e5a, 12); // 0e53  jr c,0x0e5a (taken)
      break;
    }
    m.step(0x0e55, 7); // 0e53  jr c,0x0e5a (not taken)
    m.push16(0x0e58);
    m.step(0x0e8d, 17); // 0e55  call 0x0e8d
    m.call(0x0e8d);
    m.step(0x0e4f, 12); // 0e58  jr 0x0e4f
  }

  regs.xor(regs.a);
  m.step(0x0e5b, 4); // 0e5a  xor a
  regs.hl = mem.read8(0x00a0) | (mem.read8(0x00a1) << 8);
  m.step(0x0e5e, 16); // 0e5b  ld hl,(0x00a0)
  regs.de = mem.read8(0x00a3) | (mem.read8(0x00a4) << 8);
  m.step(0x0e62, 20); // 0e5e  ld de,(0x00a3)

  regs.bc = mem.read8(0x009d) | (mem.read8(0x009e) << 8);
  m.step(0x0e66, 20); // 0e62  ld bc,(0x009d)

  regs.addHl(regs.de);
  m.step(0x0e67, 11); // 0e66  add hl,de
  regs.addHl(regs.bc);
  m.step(0x0e68, 11); // 0e67  add hl,bc
  regs.add(regs.l);
  m.step(0x0e69, 4); // 0e68  add a,l
  regs.add(regs.h);
  m.step(0x0e6a, 4); // 0e69  add a,h
  regs.sub(0x69);
  m.step(0x0e6c, 7); // 0e6a  sub 0x69

  if (regs.fNZ) {
    m.step(0x0000, 10); // 0e6c  jp nz,0x0000 -- checksum failed, hard reset
    return m.call(0x0000);
  }
  m.step(0x0e6f, 10); // 0e6c  jp nz,0x0000 (not taken)

  m.ret(); // 0e6f  ret
}
