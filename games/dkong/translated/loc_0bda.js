// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0bda  (ROM 0x0BDA–0x0C90).
 */
export function loc_0bda(m) {
  const { regs, mem } = m;

  m.push16(0x0bdd);
  m.step(0x011c, 17); // call 0x011c -- UNCONDITIONAL, before the gate
  m.call(0x011c);

  m.push16(0x0bde);
  m.step(0x0018, 11); // rst 0x18 -- gate on everything after
  if (!m.call(0x0018)) return; // skipped -> aborted to caller

  m.push16(0x0be1);
  m.step(0x0874, 17); // call 0x0874
  m.call(0x0874);

  regs.d = 0x06;
  m.step(0x0be3, 7); // ld d,0x06
  regs.a = mem.read8(0x6200);
  m.step(0x0be6, 13); // ld a,(0x6200)
  regs.e = regs.a;
  m.step(0x0be7, 4); // ld e,a
  m.push16(0x0bea);
  m.step(0x309f, 17); // call 0x309f -- enqueue DE = (0x06, mem[0x6200])
  m.call(0x309f);

  // -- seed state --
  regs.hl = 0x7d86;
  m.step(0x0bed, 10); // ld hl,0x7d86
  mem.write8(regs.hl, 0x01, 7); // 0x7D86 = 1
  m.step(0x0bef, 10);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0bf0, 6); // inc hl
  mem.write8(regs.hl, 0x00, 7); // 0x7D87 = 0
  m.step(0x0bf2, 10);
  regs.hl = 0x608a;
  m.step(0x0bf5, 10); // ld hl,0x608a
  mem.write8(regs.hl, 0x02); // 0x608A = 2
  m.step(0x0bf7, 10);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0bf8, 6); // inc hl
  mem.write8(regs.hl, 0x03); // 0x608B = 3
  m.step(0x0bfa, 10);
  regs.hl = 0x63a7;
  m.step(0x0bfd, 10); // ld hl,0x63a7
  mem.write8(regs.hl, 0x00); // 0x63A7 = 0
  m.step(0x0bff, 10);
  regs.hl = 0x76dc;
  m.step(0x0c02, 10); // ld hl,0x76dc
  mem.write16(0x63a8, regs.hl); // 0x63A8 = 0x76DC (the IX walk pointer)
  m.step(0x0c05, 16);

  // -- clamp 0x622E to <= 5 --
  regs.a = mem.read8(0x622e);
  m.step(0x0c08, 13); // ld a,(0x622e)
  regs.cp(0x06);
  m.step(0x0c0a, 7); // cp 0x06
  if (regs.fC) {
    m.step(0x0c11, 12); // jr c,0x0c11 -- < 6, keep
  } else {
    m.step(0x0c0c, 7); // jr c not taken
    regs.a = 0x05;
    m.step(0x0c0e, 7); // ld a,0x05
    mem.write8(0x622e, regs.a);
    m.step(0x0c11, 13); // ld (0x622e),a
  }

  // -- compare 0x622F vs 0x622A --
  regs.a = mem.read8(0x622f);
  m.step(0x0c14, 13); // ld a,(0x622f)
  regs.b = regs.a;
  m.step(0x0c15, 4); // ld b,a
  regs.a = mem.read8(0x622a);
  m.step(0x0c18, 13); // ld a,(0x622a)
  regs.cp(regs.b);
  m.step(0x0c19, 4); // cp b
  if (regs.fZ) {
    m.step(0x0c1f, 12); // jr z,0x0c1f -- equal, skip inc
  } else {
    m.step(0x0c1b, 7); // jr z not taken
    regs.hl = 0x622e;
    m.step(0x0c1e, 10); // ld hl,0x622e
    regs.incMem8(mem, regs.hl); // inc (hl) -- 0x622E++
    m.step(0x0c1f, 11);
  }
  mem.write8(0x622f, regs.a); // 0x622F = mem[0x622A]
  m.step(0x0c22, 13); // ld (0x622f),a

  // -- outer loop prep --
  regs.a = mem.read8(0x622e);
  m.step(0x0c25, 13); // ld a,(0x622e)
  regs.b = regs.a;
  m.step(0x0c26, 4); // ld b,a -- B = outer count
  regs.hl = 0x75bc;
  m.step(0x0c29, 10); // ld hl,0x75bc

  // ===== OUTER LOOP (loc_0c29) =====
  for (;;) {
    regs.c = 0x50;
    m.step(0x0c2b, 7); // ld c,0x50

    // ----- INNER fill (loc_0c2b): 4 bytes/group, stride 0x23, until C+3 == 0x67 -----
    for (;;) {
      mem.write8(regs.hl, regs.c);
      m.step(0x0c2c, 7); // ld (hl),c
      regs.c = (regs.c + 1) & 0xff;
      m.step(0x0c2d, 4); // inc c
      regs.hl = (regs.hl - 1) & 0xffff;
      m.step(0x0c2e, 6); // dec hl
      mem.write8(regs.hl, regs.c);
      m.step(0x0c2f, 7); // ld (hl),c
      regs.c = (regs.c + 1) & 0xff;
      m.step(0x0c30, 4); // inc c
      regs.hl = (regs.hl - 1) & 0xffff;
      m.step(0x0c31, 6); // dec hl
      mem.write8(regs.hl, regs.c);
      m.step(0x0c32, 7); // ld (hl),c
      regs.c = (regs.c + 1) & 0xff;
      m.step(0x0c33, 4); // inc c
      regs.hl = (regs.hl - 1) & 0xffff;
      m.step(0x0c34, 6); // dec hl
      mem.write8(regs.hl, regs.c);
      m.step(0x0c35, 7); // ld (hl),c -- 4th write (C is C+3)
      regs.a = regs.c;
      m.step(0x0c36, 4); // ld a,c
      regs.cp(0x67);
      m.step(0x0c38, 7); // cp 0x67
      if (regs.fZ) {
        m.step(0x0c43, 10); // jp z,0x0c43 -- exit inner
        break;
      }
      m.step(0x0c3b, 10); // jp z not taken
      regs.c = (regs.c + 1) & 0xff;
      m.step(0x0c3c, 4); // inc c
      regs.de = 0x0023;
      m.step(0x0c3f, 10); // ld de,0x0023
      regs.addHl(regs.de);
      m.step(0x0c40, 11); // add hl,de
      m.step(0x0c2b, 10); // jp 0x0c2b -- loop inner
    }

    // ----- IX sprite copy (loc_0c43) -----
    regs.a = mem.read8(0x63a7);
    m.step(0x0c46, 13); // ld a,(0x63a7)
    regs.a = regs.inc8(regs.a);
    m.step(0x0c47, 4); // inc a
    mem.write8(0x63a7, regs.a);
    m.step(0x0c4a, 13); // ld (0x63a7),a
    regs.a = regs.dec8(regs.a);
    m.step(0x0c4b, 4); // dec a -- A = old 0x63A7
    regs.a = regs.sla(regs.a); // sla a
    m.step(0x0c4d, 8);
    regs.a = regs.sla(regs.a); // sla a -- A = (old 0x63A7) * 4
    m.step(0x0c4f, 8);

    m.push16(regs.hl); // push hl -- save the tile-fill pointer
    m.step(0x0c50, 11);
    regs.hl = 0x3cf0;
    m.step(0x0c53, 10); // ld hl,0x3cf0
    m.push16(regs.bc); // push bc -- save the outer counter
    m.step(0x0c54, 11);
    regs.ix = mem.read16(0x63a8); // ld ix,(0x63a8) -- INDIRECT
    m.step(0x0c58, 20);
    regs.c = regs.a;
    m.step(0x0c59, 4); // ld c,a
    regs.b = 0x00;
    m.step(0x0c5b, 7); // ld b,0x00
    regs.addHl(regs.bc); // add hl,bc -- HL = 0x3CF0 + A*4 (the sprite record)
    m.step(0x0c5c, 11);

    regs.a = mem.read8(regs.hl);
    m.step(0x0c5d, 7); // ld a,(hl)
    mem.write8((regs.ix + 0x60) & 0xffff, regs.a); // ld (ix+0x60),a
    m.step(0x0c60, 19);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x0c61, 6); // inc hl
    regs.a = mem.read8(regs.hl);
    m.step(0x0c62, 7); // ld a,(hl)
    mem.write8((regs.ix + 0x40) & 0xffff, regs.a); // ld (ix+0x40),a
    m.step(0x0c65, 19);
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x0c66, 6); // inc hl
    regs.a = mem.read8(regs.hl);
    m.step(0x0c67, 7); // ld a,(hl)
    mem.write8((regs.ix + 0x20) & 0xffff, regs.a); // ld (ix+0x20),a
    m.step(0x0c6a, 19);
    mem.write8((regs.ix - 0x20) & 0xffff, 0x8b); // ld (ix-0x20),0x8b -- NEGATIVE disp
    m.step(0x0c6e, 19);

    regs.bc = m.pop16(); // pop bc
    m.step(0x0c6f, 10);
    m.push16(regs.ix); // push ix
    m.step(0x0c71, 15);
    regs.hl = m.pop16(); // pop hl -- HL = IX
    m.step(0x0c72, 10);
    regs.de = 0xfffc;
    m.step(0x0c75, 10); // ld de,0xfffc (= -4)
    regs.addHl(regs.de); // add hl,de -- HL = IX - 4
    m.step(0x0c76, 11);
    mem.write16(0x63a8, regs.hl); // 0x63A8 = IX - 4 (next sprite slot)
    m.step(0x0c79, 16);
    regs.hl = m.pop16(); // pop hl -- restore the tile-fill pointer
    m.step(0x0c7a, 10);
    regs.de = 0xff5f;
    m.step(0x0c7d, 10); // ld de,0xff5f (= -0xA1)
    regs.addHl(regs.de); // add hl,de -- HL -= 0xA1 (next row, downward)
    m.step(0x0c7e, 11);
    regs.b = (regs.b - 1) & 0xff;
    m.step(0x0c7f, 4); // dec b
    if (regs.b !== 0) {
      m.step(0x0c29, 10); // jp nz,0x0c29 -- outer loop
      continue;
    }
    m.step(0x0c82, 10); // jp nz not taken -> exit
    break;
  }

  // -- epilogue --
  regs.de = 0x0307;
  m.step(0x0c85, 10); // ld de,0x0307
  m.push16(0x0c88);
  m.step(0x309f, 17); // call 0x309f -- enqueue DE = 0x0307
  m.call(0x309f);

  regs.hl = 0x6009;
  m.step(0x0c8b, 10); // ld hl,0x6009
  mem.write8(regs.hl, 0xa0); // 0x6009 = 0xA0 (arm countdown)
  m.step(0x0c8d, 10);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0c8e, 6); // inc hl -- HL = 0x600A
  regs.incMem8(mem, regs.hl); // inc (hl) -- 0x600A += 1
  m.step(0x0c8f, 11);
  regs.incMem8(mem, regs.hl); // inc (hl) -- 0x600A += 2 total
  m.step(0x0c90, 11);
  m.ret(); // ret (0x0C90)
}
