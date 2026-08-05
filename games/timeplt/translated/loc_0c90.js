// SPDX-License-Identifier: GPL-3.0-only

// loc_0c90  (ROM 0x0C90-0x0D1A)
export function loc_0c90(m) {
  const { regs, mem } = m;

  regs.c = regs.a;
  m.step(0x0c91, 4); // 0c90  ld c,a
  regs.b = 0x00;
  m.step(0x0c93, 7); // 0c91  ld b,0x00

  regs.a = mem.read8(0xad30);
  m.step(0x0c96, 13); // 0c93  ld a,(0xad30)
  regs.and(regs.a);
  m.step(0x0c97, 4); // 0c96  and a

  if (regs.fZ) {
    m.step(0x0ce8, 10); // 0c97  jp z,0x0ce8 (taken)
    return m.call(0x0ce8);
  }
  m.step(0x0c9a, 10); // 0c97  jp z,0x0ce8 (not taken)

  regs.a = regs.c;
  m.step(0x0c9b, 4); // 0c9a  ld a,c
  regs.and(regs.a);
  m.step(0x0c9c, 4); // 0c9b  and a

  if (regs.fZ) {
    m.step(0x0ce9, 10); // 0c9c  jp z,0x0ce9 (taken)
    return loc_0c90_0ce9(m);
  }
  m.step(0x0c9f, 10); // 0c9c  jp z,0x0ce9 (not taken)

  regs.hl = 0x0d27;
  m.step(0x0ca2, 10); // 0c9f  ld hl,0x0d27
  regs.addHl(regs.bc);
  m.step(0x0ca3, 11); // 0ca2  add hl,bc
  regs.addHl(regs.bc);
  m.step(0x0ca4, 11); // 0ca3  add hl,bc
  regs.addHl(regs.bc);
  m.step(0x0ca5, 11); // 0ca4  add hl,bc -- index * 3

  regs.de = 0xad33;
  m.step(0x0ca8, 10); // 0ca5  ld de,0xad33
  regs.a = mem.read8(0xad32);
  m.step(0x0cab, 13); // 0ca8  ld a,(0xad32)
  regs.and(regs.a);
  m.step(0x0cac, 4); // 0cab  and a

  if (regs.fZ) {
    m.step(0x0cb1, 12); // 0cac  jr z,0x0cb1 (taken)
  } else {
    m.step(0x0cae, 7); // 0cac  jr z,0x0cb1 (not taken)
    regs.de = 0xad36;
    m.step(0x0cb1, 10); // 0cae  ld de,0xad36 -- player 2
  }

  regs.a = mem.read8(regs.de);
  m.step(0x0cb2, 7); // 0cb1  ld a,(de)
  regs.add(mem.read8(regs.hl));
  m.step(0x0cb3, 7); // 0cb2  add a,(hl)
  regs.daa();
  m.step(0x0cb4, 4); // 0cb3  daa
  mem.write8(regs.de, regs.a);
  m.step(0x0cb5, 7); // 0cb4  ld (de),a
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x0cb6, 6); // 0cb5  inc de
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0cb7, 6); // 0cb6  inc hl

  regs.a = mem.read8(regs.de);
  m.step(0x0cb8, 7); // 0cb7  ld a,(de)
  regs.adc(mem.read8(regs.hl));
  m.step(0x0cb9, 7); // 0cb8  adc a,(hl)
  regs.daa();
  m.step(0x0cba, 4); // 0cb9  daa
  mem.write8(regs.de, regs.a);
  m.step(0x0cbb, 7); // 0cba  ld (de),a
  regs.de = (regs.de + 1) & 0xffff;
  m.step(0x0cbc, 6); // 0cbb  inc de
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0cbd, 6); // 0cbc  inc hl

  regs.a = mem.read8(regs.de);
  m.step(0x0cbe, 7); // 0cbd  ld a,(de)
  regs.adc(mem.read8(regs.hl));
  m.step(0x0cbf, 7); // 0cbe  adc a,(hl)
  regs.daa();
  m.step(0x0cc0, 4); // 0cbf  daa
  mem.write8(regs.de, regs.a);
  m.step(0x0cc1, 7); // 0cc0  ld (de),a

  regs.hl = 0xa98d;
  m.step(0x0cc4, 10); // 0cc1  ld hl,0xa98d
  regs.bc = 0x0003;
  m.step(0x0cc7, 10); // 0cc4  ld bc,0x0003

  let promote = false;
  for (;;) {
    regs.a = mem.read8(regs.de);
    m.step(0x0cc8, 7); // 0cc7  ld a,(de)
    regs.cp(mem.read8(regs.hl));
    m.step(0x0cc9, 7); // 0cc8  cp (hl)

    if (regs.fC) {
      m.step(0x0cda, 12); // 0cc9  jr c,0x0cda (taken) -- lower, done
      break;
    }
    m.step(0x0ccb, 7); // 0cc9  jr c,0x0cda (not taken)

    if (regs.fNZ) {
      m.step(0x0cd4, 12); // 0ccb  jr nz,0x0cd4 (taken) -- higher, promote
      promote = true;
      break;
    }
    m.step(0x0ccd, 7); // 0ccb  jr nz,0x0cd4 (not taken) -- equal so far

    regs.de = (regs.de - 1) & 0xffff;
    m.step(0x0cce, 6); // 0ccd  dec de
    regs.hl = (regs.hl - 1) & 0xffff;
    m.step(0x0ccf, 6); // 0cce  dec hl
    regs.c = regs.dec8(regs.c);
    m.step(0x0cd0, 4); // 0ccf  dec c

    if (regs.fNZ) {
      m.step(0x0cc7, 12); // 0cd0  jr nz,0x0cc7 (taken)
      continue;
    }
    m.step(0x0cd2, 7); // 0cd0  jr nz,0x0cc7 (not taken) -- all three equal
    m.step(0x0cda, 12); // 0cd2  jr 0x0cda
    break;
  }

  if (promote) {
    regs.exDeHl();
    m.step(0x0cd5, 4); // 0cd4  ex de,hl
    m.lddrAt(0x0cd5, 0x0cd7); // 0cd5  lddr -- the bytes not yet compared
    m.push16(0x0cda);
    m.step(0x0d6b, 17); // 0cd7  call 0x0d6b -- redraw the high score
    m.call(0x0d6b);
  }

  regs.a = mem.read8(0xad32);
  m.step(0x0cdd, 13); // 0cda  ld a,(0xad32)
  regs.and(regs.a);
  m.step(0x0cde, 4); // 0cdd  and a

  if (regs.fNZ) {
    m.step(0x0ce5, 12); // 0cde  jr nz,0x0ce5 (taken)
    m.push16(0x0ce8);
    m.step(0x0d61, 17); // 0ce5  call 0x0d61 -- 2-UP
    m.call(0x0d61);
  } else {
    m.step(0x0ce0, 7); // 0cde  jr nz,0x0ce5 (not taken)
    m.push16(0x0ce3);
    m.step(0x0d57, 17); // 0ce0  call 0x0d57 -- 1-UP
    m.call(0x0d57);
    m.step(0x0ce8, 12); // 0ce3  jr 0x0ce8
    return m.call(0x0ce8);
  }

  return m.call(0x0ce8);
}

function loc_0c90_0ce9(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xad31);
  m.step(0x0cec, 13); // 0ce9  ld a,(0xad31)
  regs.and(regs.a);
  m.step(0x0ced, 4); // 0cec  and a

  if (regs.fNZ) {
    m.step(0x0d0a, 12); // 0ced  jr nz,0x0d0a (taken) -- two players

    regs.a = 0x06;
    m.step(0x0d0c, 7); // 0d0a  ld a,0x06
    m.push16(0x0d0f);
    m.step(0x0bf2, 17); // 0d0c  call 0x0bf2
    m.call(0x0bf2);
    m.push16(0x0d12);
    m.step(0x0d57, 17); // 0d0f  call 0x0d57
    m.call(0x0d57);
    regs.a = 0x07;
    m.step(0x0d14, 7); // 0d12  ld a,0x07
    m.push16(0x0d17);
    m.step(0x0bf2, 17); // 0d14  call 0x0bf2
    m.call(0x0bf2);
    m.push16(0x0d1a);
    m.step(0x0d61, 17); // 0d17  call 0x0d61
    m.call(0x0d61);
    m.ret(); // 0d1a  ret
    return;
  }
  m.step(0x0cef, 7); // 0ced  jr nz,0x0d0a (not taken) -- one player

  regs.a = mem.read8(0x0b31);
  m.step(0x0cf2, 13); // 0cef  ld a,(0x0b31) -- 0x06, out of ROM code
  m.push16(0x0cf5);
  m.step(0x0bf2, 17); // 0cf2  call 0x0bf2
  m.call(0x0bf2);
  m.push16(0x0cf8);
  m.step(0x0d57, 17); // 0cf5  call 0x0d57
  m.call(0x0d57);

  regs.a = mem.read8(0x15c6);
  m.step(0x0cfb, 13); // 0cf8  ld a,(0x15c6) -- 0x07, out of ROM code
  m.push16(0x0cfe);
  m.step(0x0c39, 17); // 0cfb  call 0x0c39 -- erase the 2-UP label
  m.call(0x0c39);

  regs.de = 0xa501;
  m.step(0x0d01, 10); // 0cfe  ld de,0xa501
  regs.b = 0x06;
  m.step(0x0d03, 7); // 0d01  ld b,0x06

  do {
    regs.a = 0xf1;
    m.step(0x0d05, 7); // 0d03  ld a,0xf1
    mem.write8(regs.de, regs.a, 4);
    m.step(0x0d06, 7); // 0d05  ld (de),a
    m.push16(0x0d07);
    m.step(0x0020, 11); // 0d06  rst 0x20 -- DE -= 0x20
    m.call(0x0020);
    regs.djnz(); // no flags
    m.step(regs.b !== 0 ? 0x0d03 : 0x0d09, regs.b !== 0 ? 13 : 8); // 0d07  djnz 0x0d03
  } while (regs.b !== 0);

  m.ret(); // 0d09  ret
}
