// SPDX-License-Identifier: GPL-3.0-only

// loc_4cc3  (ROM 0x4CC3-0x4D2A)
export function loc_4cc3(m) {
  const { regs, mem } = m;

  regs.hl = 0xab0b;
  m.step(0x4cc6, 10); // 4cc3  ld hl,0xab0b
  regs.b = 0x05;
  m.step(0x4cc8, 7); // 4cc6  ld b,0x05
  regs.a = mem.read8(0xad32);
  m.step(0x4ccb, 13); // 4cc8  ld a,(0xad32)
  regs.and(regs.a);
  m.step(0x4ccc, 4); // 4ccb  and a
  regs.de = 0xad35;
  m.step(0x4ccf, 10); // 4ccc  ld de,0xad35 -- no flags, the Z above survives
  if (regs.fZ) {
    m.step(0x4cd4, 12); // 4ccf  jr z,0x4cd4 (taken)
  } else {
    m.step(0x4cd1, 7); // 4ccf  jr z (not taken)
    regs.de = 0xad38;
    m.step(0x4cd4, 10); // 4cd1  ld de,0xad38
  }

  let beaten = false; // left the loop by `jr nc,0x4ce4`
  for (;;) {
    m.push16(regs.hl);
    m.step(0x4cd5, 11); // 4cd4  push hl
    m.push16(regs.de);
    m.step(0x4cd6, 11); // 4cd5  push de

    m.push16(0x4cd9);
    m.step(0x4d2b, 17); // 4cd6  call 0x4d2b
    m.call(0x4d2b);

    if (regs.fNC) {
      m.step(0x4ce4, 12); // 4cd9  jr nc,0x4ce4 (taken) -- this is the slot
      beaten = true;
      break;
    }
    m.step(0x4cdb, 7); // 4cd9  jr nc (not taken)

    regs.de = m.pop16();
    m.step(0x4cdc, 10); // 4cdb  pop de
    regs.hl = m.pop16();
    m.step(0x4cdd, 10); // 4cdc  pop hl
    regs.a = 0x08;
    m.step(0x4cdf, 7); // 4cdd  ld a,0x08

    m.push16(0x4ce0);
    m.step(0x0008, 11); // 4cdf  rst 0x08 -- HL += 8, A = (HL)
    m.call(0x0008);

    if (regs.djnz() !== 0) {
      m.step(0x4cd4, 13); // 4ce0  djnz 0x4cd4 (taken)
      continue;
    }
    m.step(0x4ce2, 8); // 4ce0  djnz (not taken)
    break;
  }

  if (!beaten) {
    regs.scf();
    m.step(0x4ce3, 4); // 4ce2  scf -- nothing was inserted
    m.ret(); // 4ce3  ret
    return;
  }

  regs.b = regs.dec8(regs.b);
  m.step(0x4ce5, 4); // 4ce4  dec b
  if (regs.fZ) {
    m.step(0x4d26, 12); // 4ce5  jr z,0x4d26 (taken) -- the last record lost

    regs.hl = 0xab2f;
    m.step(0x4d29, 10); // 4d26  ld hl,0xab2f
    m.step(0x4cf7, 12); // 4d29  jr 0x4cf7 -- back into the body
  } else {
    m.step(0x4ce7, 7); // 4ce5  jr z (not taken)

    regs.hl = 0xab27;
    m.step(0x4cea, 10); // 4ce7  ld hl,0xab27
    regs.de = 0xab2f;
    m.step(0x4ced, 10); // 4cea  ld de,0xab2f
    regs.a = regs.b;
    m.step(0x4cee, 4); // 4ced  ld a,b
    regs.add(regs.a);
    m.step(0x4cef, 4); // 4cee  add a,a
    regs.add(regs.a);
    m.step(0x4cf0, 4); // 4cef  add a,a
    regs.add(regs.a);
    m.step(0x4cf1, 4); // 4cf0  add a,a -- B * 8 bytes
    regs.c = regs.a;
    m.step(0x4cf2, 4); // 4cf1  ld c,a
    regs.b = 0x00;
    m.step(0x4cf4, 7); // 4cf2  ld b,0x00

    m.lddrAt(0x4cf4, 0x4cf6); // 4cf4  lddr -- slide the tail down one record

    regs.exDeHl();
    m.step(0x4cf7, 4); // 4cf6  ex de,hl
  }

  regs.hl = (regs.hl - 1) & 0xffff;
  m.step(0x4cf8, 6); // 4cf7  dec hl
  mem.write8(regs.hl, 0xf1);
  m.step(0x4cfa, 10); // 4cf8  ld (hl),0xf1
  regs.hl = (regs.hl - 1) & 0xffff;
  m.step(0x4cfb, 6); // 4cfa  dec hl
  mem.write8(regs.hl, 0xf1);
  m.step(0x4cfd, 10); // 4cfb  ld (hl),0xf1
  regs.hl = (regs.hl - 1) & 0xffff;
  m.step(0x4cfe, 6); // 4cfd  dec hl
  mem.write8(regs.hl, 0xf1);
  m.step(0x4d00, 10); // 4cfe  ld (hl),0xf1

  mem.write16(0xa991, regs.hl);
  m.step(0x4d03, 16); // 4d00  ld (0xa991),hl
  regs.hl = (regs.hl - 1) & 0xffff;
  m.step(0x4d04, 6); // 4d03  dec hl
  regs.de = m.pop16();
  m.step(0x4d05, 10); // 4d04  pop de -- the candidate pointer pushed at 0x4cd5
  regs.bc = 0x0003;
  m.step(0x4d08, 10); // 4d05  ld bc,0x0003
  regs.exDeHl();
  m.step(0x4d09, 4); // 4d08  ex de,hl

  m.lddrAt(0x4d09, 0x4d0b); // 4d09  lddr -- the three candidate bytes

  regs.a = mem.read8(regs.de);
  m.step(0x4d0c, 7); // 4d0b  ld a,(de)
  regs.hl = m.pop16();
  m.step(0x4d0d, 10); // 4d0c  pop hl -- balances 0x4cd4, value discarded next
  regs.hl = 0xa531;
  m.step(0x4d10, 10); // 4d0d  ld hl,0xa531
  regs.add(regs.a);
  m.step(0x4d11, 4); // 4d10  add a,a

  m.push16(0x4d12);
  m.step(0x0008, 11); // 4d11  rst 0x08 -- HL = 0xa531 + 2A
  m.call(0x0008);

  mem.write16(0xa993, regs.hl);
  m.step(0x4d15, 16); // 4d12  ld (0xa993),hl

  regs.hl = 0xab08;
  m.step(0x4d18, 10); // 4d15  ld hl,0xab08
  regs.de = 0x0008;
  m.step(0x4d1b, 10); // 4d18  ld de,0x0008
  regs.b = 0x05;
  m.step(0x4d1d, 7); // 4d1b  ld b,0x05
  regs.xor(regs.a);
  m.step(0x4d1e, 4); // 4d1d  xor a

  for (;;) {
    mem.write8(regs.hl, regs.a);
    m.step(0x4d1f, 7); // 4d1e  ld (hl),a
    regs.addHl(regs.de);
    m.step(0x4d20, 11); // 4d1f  add hl,de
    regs.a = regs.inc8(regs.a);
    m.step(0x4d21, 4); // 4d20  inc a
    if (regs.djnz() !== 0) {
      m.step(0x4d1e, 13); // 4d21  djnz 0x4d1e (taken)
      continue;
    }
    m.step(0x4d23, 8); // 4d21  djnz (not taken)
    break;
  }

  regs.scf();
  m.step(0x4d24, 4); // 4d23  scf
  regs.ccf();
  m.step(0x4d25, 4); // 4d24  ccf -- carry clear: something was inserted

  m.ret(); // 4d25  ret
}
