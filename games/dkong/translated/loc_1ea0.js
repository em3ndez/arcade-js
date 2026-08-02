// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1ea0  (ROM 0x1EA0–0x1F08) — sub_1e96 dispatch target, index 0.
 *
 *   1ea0  3a 52 63     ld   a,(0x6352)
 *   1ea3  fe 65        cp   0x65
 *   1ea5  21 b8 69     ld   hl,0x69b8
 *   1ea8  ca b4 1e     jp   z,0x1eb4        ; == -> HL 0x69b8
 *   1eab  21 d0 69     ld   hl,0x69d0
 *   1eae  da b4 1e     jp   c,0x1eb4        ; <  -> HL 0x69d0
 *   1eb1  21 80 69     ld   hl,0x6980       ; >  -> HL 0x6980
 *   1eb4  dd 2a 51 63  ld   ix,(0x6351)     ; FIRST USE, 20 T
 *   1eb8  16 00        ld   d,0x00
 *   1eba  3a 53 63     ld   a,(0x6353)
 *   1ebd  5f           ld   e,a             ; DE = 0x00:(0x6353)
 *   1ebe  01 04 00     ld   bc,0x0004
 *   1ec1  3a 54 63     ld   a,(0x6354)
 *   1ec4  a7           and  a
 *   1ec5  ca cf 1e     jp   z,0x1ecf        ; (0x6354)==0 -> skip loop
 *   1ec8  09           add  hl,bc           ; loop: HL += 4
 *   1ec9  dd 19        add  ix,de           ;       IX += DE
 *   1ecb  3d           dec  a
 *   1ecc  c2 c8 1e     jp   nz,0x1ec8
 *   1ecf  dd 36 00 00  ld   (ix+0x00),0x00
 *   1ed3  dd 7e 15     ld   a,(ix+0x15)
 *   1ed6  a7           and  a
 *   1ed7  3e 02        ld   a,0x02
 *   1ed9  ca de 1e     jp   z,0x1ede        ; (ix+0x15)==0 -> keep 0x02
 *   1edc  3e 04        ld   a,0x04          ; else 0x04
 *   1ede  32 42 63     ld   (0x6342),a
 *   1ee1  01 2c 6a     ld   bc,0x6a2c
 *   1ee4  7e           ld   a,(hl)
 *   1ee5  36 00        ld   (hl),0x00
 *   1ee7  02           ld   (bc),a          ; FIRST USE, 7 T
 *   1ee8  0c           inc  c
 *   1ee9  2c           inc  l
 *   1eea  3e 60        ld   a,0x60
 *   1eec  02           ld   (bc),a
 *   1eed  0c           inc  c
 *   1eee  2c           inc  l
 *   1eef  3e 0c        ld   a,0x0c
 *   1ef1  02           ld   (bc),a
 *   1ef2  0c           inc  c
 *   1ef3  2c           inc  l
 *   1ef4  7e           ld   a,(hl)
 *   1ef5  02           ld   (bc),a
 *   1ef6  21 45 63     ld   hl,0x6345
 *   1ef9  34           inc  (hl)            ; STATE ADVANCE 0x6345 (incMem8)
 *   1efa  2c           inc  l
 *   1efb  36 06        ld   (hl),0x06       ; 0x6346 = 6
 *   1efd  2c           inc  l
 *   1efe  36 05        ld   (hl),0x05       ; 0x6347 = 5
 *   1f00  21 8a 60     ld   hl,0x608a
 *   1f03  36 06        ld   (hl),0x06       ; 0x608a = 6
 *   1f05  2c           inc  l
 *   1f06  36 03        ld   (hl),0x03       ; 0x608b = 3
 *   1f08  c9           ret
 */
export function loc_1ea0(m) {
  const { regs, mem } = m;

  // ---- HL select by (0x6352) vs 0x65; cp's flags survive the flag-neutral ld hl ----
  regs.a = mem.read8(0x6352);
  m.step(0x1ea3, 13); // ld a,(0x6352)
  regs.cp(0x65);
  m.step(0x1ea5, 7); // cp 0x65
  regs.hl = 0x69b8;
  m.step(0x1ea8, 10); // ld hl,0x69b8
  if (regs.fZ) {
    m.step(0x1eb4, 10); // jp z,0x1eb4 taken (==)
  } else {
    m.step(0x1eab, 10); // jp z not taken
    regs.hl = 0x69d0;
    m.step(0x1eae, 10); // ld hl,0x69d0
    if (regs.fC) {
      m.step(0x1eb4, 10); // jp c,0x1eb4 taken (<)
    } else {
      m.step(0x1eb1, 10); // jp c not taken
      regs.hl = 0x6980;
      m.step(0x1eb4, 10); // ld hl,0x6980 (falls into loc_1eb4)
    }
  }

  // ---- loc_1eb4: set up IX, DE, BC, and the loop count ----
  regs.ix = mem.read16(0x6351); // ld ix,(0x6351) -- FIRST USE, 20 T (vs MAME z80.lst)
  m.step(0x1eb8, 20);
  regs.d = 0x00;
  m.step(0x1eba, 7); // ld d,0x00
  regs.a = mem.read8(0x6353);
  m.step(0x1ebd, 13); // ld a,(0x6353)
  regs.e = regs.a;
  m.step(0x1ebe, 4); // ld e,a
  regs.bc = 0x0004;
  m.step(0x1ec1, 10); // ld bc,0x0004
  regs.a = mem.read8(0x6354);
  m.step(0x1ec4, 13); // ld a,(0x6354)
  regs.and(regs.a);
  m.step(0x1ec5, 4); // and a
  if (regs.fZ) {
    m.step(0x1ecf, 10); // jp z,0x1ecf -- (0x6354)==0, skip the loop
  } else {
    m.step(0x1ec8, 10); // jp z not taken -> enter loop
    for (;;) {
      regs.addHl(regs.bc); // add hl,bc -- HL += 4, INSIDE the loop (draft TEST 3)
      m.step(0x1ec9, 11);
      regs.addIx(regs.de); // add ix,de -- IX += DE, INSIDE the loop
      m.step(0x1ecb, 15);
      regs.a = regs.dec8(regs.a);
      m.step(0x1ecc, 4); // dec a
      if (regs.fNZ) {
        m.step(0x1ec8, 10); // jp nz,0x1ec8 taken -- next iteration
        continue;
      }
      m.step(0x1ecf, 10); // jp nz not taken -> fall to loc_1ecf
      break;
    }
  }

  // ---- loc_1ecf: (ix+0)=0; select 0x02 vs 0x04 by (ix+0x15) ----
  mem.write8((regs.ix + 0x00) & 0xffff, 0x00);
  m.step(0x1ed3, 19); // ld (ix+0x00),0x00
  regs.a = mem.read8((regs.ix + 0x15) & 0xffff);
  m.step(0x1ed6, 19); // ld a,(ix+0x15)
  regs.and(regs.a);
  m.step(0x1ed7, 4); // and a
  regs.a = 0x02;
  m.step(0x1ed9, 7); // ld a,0x02
  if (regs.fZ) {
    m.step(0x1ede, 10); // jp z,0x1ede taken -- (ix+0x15)==0, keep 0x02
  } else {
    m.step(0x1edc, 10); // jp z not taken
    regs.a = 0x04;
    m.step(0x1ede, 7); // ld a,0x04
  }

  // ---- loc_1ede: store the selected value, then the ordered 4-byte copy (S8) ----
  mem.write8(0x6342, regs.a);
  m.step(0x1ee1, 13); // ld (0x6342),a
  regs.bc = 0x6a2c;
  m.step(0x1ee4, 10); // ld bc,0x6a2c
  regs.a = mem.read8(regs.hl);
  m.step(0x1ee5, 7); // ld a,(hl)
  mem.write8(regs.hl, 0x00);
  m.step(0x1ee7, 10); // ld (hl),0x00
  mem.write8(regs.bc, regs.a);
  m.step(0x1ee8, 7); // ld (bc),a -- FIRST USE, 7 T (vs MAME z80.lst)
  regs.c = regs.inc8(regs.c);
  m.step(0x1ee9, 4); // inc c
  regs.l = regs.inc8(regs.l);
  m.step(0x1eea, 4); // inc l
  regs.a = 0x60;
  m.step(0x1eec, 7); // ld a,0x60
  mem.write8(regs.bc, regs.a);
  m.step(0x1eed, 7); // ld (bc),a
  regs.c = regs.inc8(regs.c);
  m.step(0x1eee, 4); // inc c
  regs.l = regs.inc8(regs.l);
  m.step(0x1eef, 4); // inc l
  regs.a = 0x0c;
  m.step(0x1ef1, 7); // ld a,0x0c
  mem.write8(regs.bc, regs.a);
  m.step(0x1ef2, 7); // ld (bc),a
  regs.c = regs.inc8(regs.c);
  m.step(0x1ef3, 4); // inc c
  regs.l = regs.inc8(regs.l);
  m.step(0x1ef4, 4); // inc l
  regs.a = mem.read8(regs.hl);
  m.step(0x1ef5, 7); // ld a,(hl)
  mem.write8(regs.bc, regs.a);
  m.step(0x1ef6, 7); // ld (bc),a

  // ---- state advance: inc (0x6345) [0->1], then the four sibling stores ----
  regs.hl = 0x6345;
  m.step(0x1ef9, 10); // ld hl,0x6345
  regs.incMem8(mem, regs.hl); // inc (hl) -- 0x6345 state advance (shared RMW); flags dead here
  m.step(0x1efa, 11); // inc (hl)
  regs.l = regs.inc8(regs.l);
  m.step(0x1efb, 4); // inc l
  mem.write8(regs.hl, 0x06);
  m.step(0x1efd, 10); // ld (hl),0x06 -- 0x6346 = 6
  regs.l = regs.inc8(regs.l);
  m.step(0x1efe, 4); // inc l
  mem.write8(regs.hl, 0x05);
  m.step(0x1f00, 10); // ld (hl),0x05 -- 0x6347 = 5
  regs.hl = 0x608a;
  m.step(0x1f03, 10); // ld hl,0x608a
  mem.write8(regs.hl, 0x06);
  m.step(0x1f05, 10); // ld (hl),0x06 -- 0x608a = 6
  regs.l = regs.inc8(regs.l);
  m.step(0x1f06, 4); // inc l
  mem.write8(regs.hl, 0x03);
  m.step(0x1f08, 10); // ld (hl),0x03 -- 0x608b = 3
  m.ret(); // ret (0x1F08)
}
