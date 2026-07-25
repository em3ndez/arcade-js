// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_4b55  (ROM 0x4b55–0x4bc6, The Pit) — reads the DSW byte at 0xb000 and
 * decodes its individual bits into a block of gameplay-parameter bytes in work
 * RAM (0x804c..0x8053), plus two LS259 control-latch writes (0xb006/0xb007);
 * if DSW bit 7 is set it TAIL-jumps to loc_4f47, else it returns.
 *
 *   4b55  3a 00 b0     ld   a,(0xb000)      ; A = DSW
 *   4b58  47           ld   b,a             ; keep the whole DSW in B for bit tests
 *   4b59  e6 03        and  0x03
 *   4b5b  ee 03        xor  0x03
 *   4b5d  20 05        jr   nz,0x4b64       ; (DSW & 3) != 3 -> loc_4b64
 *   4b5f  21 00 00     ld   hl,0x0000
 *   4b62  18 13        jr   0x4b77
 * loc_4b64:
 *   4b64  21 01 02     ld   hl,0x0201
 *   4b67  cb 40        bit  0,b
 *   4b69  28 05        jr   z,0x4b70
 *   4b6b  21 02 03     ld   hl,0x0302
 *   4b6e  18 07        jr   0x4b77
 * loc_4b70:
 *   4b70  cb 48        bit  1,b
 *   4b72  28 03        jr   z,0x4b77
 *   4b74  21 02 04     ld   hl,0x0402
 * loc_4b77:
 *   4b77  22 4c 80     ld   (0x804c),hl
 *   4b7a  3e 0c        ld   a,0x0c
 *   4b7c  cb 50        bit  2,b
 *   4b7e  20 02        jr   nz,0x4b82
 *   4b80  d6 02        sub  0x02
 * loc_4b82:
 *   4b82  32 4e 80     ld   (0x804e),a
 *   4b85  3e 37        ld   a,0x37
 *   4b87  cb 58        bit  3,b
 *   4b89  28 02        jr   z,0x4b8d
 *   4b8b  d6 0a        sub  0x0a
 * loc_4b8d:
 *   4b8d  32 4f 80     ld   (0x804f),a
 *   4b90  3e 00        ld   a,0x00
 *   4b92  cb 60        bit  4,b
 *   4b94  28 01        jr   z,0x4b97
 *   4b96  3c           inc  a
 * loc_4b97:
 *   4b97  32 50 80     ld   (0x8050),a
 *   4b9a  57           ld   d,a
 *   4b9b  3e 00        ld   a,0x00
 *   4b9d  cb 68        bit  5,b
 *   4b9f  28 01        jr   z,0x4ba2
 *   4ba1  3c           inc  a
 * loc_4ba2:
 *   4ba2  32 52 80     ld   (0x8052),a
 *   4ba5  4f           ld   c,a
 *   4ba6  3a 02 80     ld   a,(0x8002)
 *   4ba9  3d           dec  a
 *   4baa  a1           and  c
 *   4bab  aa           xor  d
 *   4bac  32 06 b0     ld   (0xb006),a
 *   4baf  32 07 b0     ld   (0xb007),a
 *   4bb2  cb 27        sla  a
 *   4bb4  32 51 80     ld   (0x8051),a
 *   4bb7  3e 03        ld   a,0x03
 *   4bb9  cb 70        bit  6,b
 *   4bbb  28 01        jr   z,0x4bbe
 *   4bbd  3c           inc  a
 * loc_4bbe:
 *   4bbe  32 53 80     ld   (0x8053),a
 *   4bc1  cb 78        bit  7,b
 *   4bc3  c2 47 4f     jp   nz,0x4f47       ; DSW b7 set -> TAIL to loc_4f47
 *   4bc6  c9           ret
 *
 * Control flow: three forward-branch clusters at the top pick HL (the 0x804c
 * word) from B's low two bits; each subsequent parameter (0x804e/0x804f/0x8050/
 * 0x8052/0x8051/0x8053) is a constant adjusted by one DSW bit (2..6). The core at
 * 0x4ba6 folds a masked+dec'd copy of 0x8002 through C and D into 0xb006/0xb007
 * and 0x8051 (= that byte << 1). The final `jp nz,0x4f47` is a CONDITIONAL
 * TAIL-jump: taken, loc_4f47's own `ret` unwinds to loc_4b55's caller, so it is
 * modelled as `return m.call(0x4f47)` with NO trailing m.ret (a second pop);
 * not taken, PC falls through to the real `ret` at 0x4bc6. Flags at exit come
 * from `bit 7,b` on both paths. The two 0xb006/0xb007 stores are hardware writes
 * to the LS259 latch (busOffset 10 = `ld (nn),a`); only bit 0 of A reaches each.
 */
export function loc_4b55(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0xb000); // 4b55  ld a,(0xb000)
  m.step(0x4b58, 13);
  regs.b = regs.a; // 4b58  ld b,a
  m.step(0x4b59, 4);
  regs.and(0x03); // 4b59  and 0x03
  m.step(0x4b5b, 7);
  regs.xor(0x03); // 4b5b  xor 0x03
  m.step(0x4b5d, 7);

  // 4b5d  jr nz,0x4b64
  if (regs.fNZ) {
    m.step(0x4b64, 12); // taken -> loc_4b64
    // loc_4b64
    regs.hl = 0x0201; // 4b64  ld hl,0x0201
    m.step(0x4b67, 10);
    regs.bit(0, regs.b); // 4b67  bit 0,b
    m.step(0x4b69, 8);
    // 4b69  jr z,0x4b70
    if (regs.fZ) {
      m.step(0x4b70, 12); // taken -> loc_4b70
      // loc_4b70
      regs.bit(1, regs.b); // 4b70  bit 1,b
      m.step(0x4b72, 8);
      // 4b72  jr z,0x4b77
      if (regs.fZ) {
        m.step(0x4b77, 12); // taken -> loc_4b77 (HL stays 0x0201)
      } else {
        m.step(0x4b74, 7); // not taken -> 4b74
        regs.hl = 0x0402; // 4b74  ld hl,0x0402
        m.step(0x4b77, 10);
      }
    } else {
      m.step(0x4b6b, 7); // not taken -> 4b6b
      regs.hl = 0x0302; // 4b6b  ld hl,0x0302
      m.step(0x4b6e, 10);
      m.step(0x4b77, 12); // 4b6e  jr 0x4b77 (unconditional)
    }
  } else {
    m.step(0x4b5f, 7); // not taken -> 4b5f
    regs.hl = 0x0000; // 4b5f  ld hl,0x0000
    m.step(0x4b62, 10);
    m.step(0x4b77, 12); // 4b62  jr 0x4b77 (unconditional)
  }

  // loc_4b77 (all paths converge)
  mem.write16(0x804c, regs.hl); // 4b77  ld (0x804c),hl
  m.step(0x4b7a, 16);
  regs.a = 0x0c; // 4b7a  ld a,0x0c
  m.step(0x4b7c, 7);
  regs.bit(2, regs.b); // 4b7c  bit 2,b
  m.step(0x4b7e, 8);
  // 4b7e  jr nz,0x4b82
  if (regs.fNZ) {
    m.step(0x4b82, 12); // taken -> loc_4b82 (A stays 0x0c)
  } else {
    m.step(0x4b80, 7); // not taken -> 4b80
    regs.sub(0x02); // 4b80  sub 0x02
    m.step(0x4b82, 7);
  }

  // loc_4b82
  mem.write8(0x804e, regs.a); // 4b82  ld (0x804e),a
  m.step(0x4b85, 13);
  regs.a = 0x37; // 4b85  ld a,0x37
  m.step(0x4b87, 7);
  regs.bit(3, regs.b); // 4b87  bit 3,b
  m.step(0x4b89, 8);
  // 4b89  jr z,0x4b8d
  if (regs.fZ) {
    m.step(0x4b8d, 12); // taken -> loc_4b8d (A stays 0x37)
  } else {
    m.step(0x4b8b, 7); // not taken -> 4b8b
    regs.sub(0x0a); // 4b8b  sub 0x0a
    m.step(0x4b8d, 7);
  }

  // loc_4b8d
  mem.write8(0x804f, regs.a); // 4b8d  ld (0x804f),a
  m.step(0x4b90, 13);
  regs.a = 0x00; // 4b90  ld a,0x00
  m.step(0x4b92, 7);
  regs.bit(4, regs.b); // 4b92  bit 4,b
  m.step(0x4b94, 8);
  // 4b94  jr z,0x4b97
  if (regs.fZ) {
    m.step(0x4b97, 12); // taken -> loc_4b97 (A stays 0x00)
  } else {
    m.step(0x4b96, 7); // not taken -> 4b96
    regs.a = regs.inc8(regs.a); // 4b96  inc a
    m.step(0x4b97, 4);
  }

  // loc_4b97
  mem.write8(0x8050, regs.a); // 4b97  ld (0x8050),a
  m.step(0x4b9a, 13);
  regs.d = regs.a; // 4b9a  ld d,a
  m.step(0x4b9b, 4);
  regs.a = 0x00; // 4b9b  ld a,0x00
  m.step(0x4b9d, 7);
  regs.bit(5, regs.b); // 4b9d  bit 5,b
  m.step(0x4b9f, 8);
  // 4b9f  jr z,0x4ba2
  if (regs.fZ) {
    m.step(0x4ba2, 12); // taken -> loc_4ba2 (A stays 0x00)
  } else {
    m.step(0x4ba1, 7); // not taken -> 4ba1
    regs.a = regs.inc8(regs.a); // 4ba1  inc a
    m.step(0x4ba2, 4);
  }

  // loc_4ba2
  mem.write8(0x8052, regs.a); // 4ba2  ld (0x8052),a
  m.step(0x4ba5, 13);
  regs.c = regs.a; // 4ba5  ld c,a
  m.step(0x4ba6, 4);
  regs.a = mem.read8(0x8002); // 4ba6  ld a,(0x8002)
  m.step(0x4ba9, 13);
  regs.a = regs.dec8(regs.a); // 4ba9  dec a
  m.step(0x4baa, 4);
  regs.and(regs.c); // 4baa  and c
  m.step(0x4bab, 4);
  regs.xor(regs.d); // 4bab  xor d
  m.step(0x4bac, 4);
  mem.write8(0xb006, regs.a, 10); // 4bac  ld (0xb006),a -- LS259 b6 <- A&1
  m.step(0x4baf, 13);
  mem.write8(0xb007, regs.a, 10); // 4baf  ld (0xb007),a -- LS259 b7 <- A&1
  m.step(0x4bb2, 13);
  regs.a = regs.sla(regs.a); // 4bb2  sla a
  m.step(0x4bb4, 8);
  mem.write8(0x8051, regs.a); // 4bb4  ld (0x8051),a
  m.step(0x4bb7, 13);
  regs.a = 0x03; // 4bb7  ld a,0x03
  m.step(0x4bb9, 7);
  regs.bit(6, regs.b); // 4bb9  bit 6,b
  m.step(0x4bbb, 8);
  // 4bbb  jr z,0x4bbe
  if (regs.fZ) {
    m.step(0x4bbe, 12); // taken -> loc_4bbe (A stays 0x03)
  } else {
    m.step(0x4bbd, 7); // not taken -> 4bbd
    regs.a = regs.inc8(regs.a); // 4bbd  inc a
    m.step(0x4bbe, 4);
  }

  // loc_4bbe
  mem.write8(0x8053, regs.a); // 4bbe  ld (0x8053),a
  m.step(0x4bc1, 13);
  regs.bit(7, regs.b); // 4bc1  bit 7,b
  m.step(0x4bc3, 8);
  // 4bc3  jp nz,0x4f47 -- CONDITIONAL TAIL-jump (10 T whether taken or not)
  if (regs.fNZ) {
    m.step(0x4f47, 10); // taken -> loc_4f47 (discards no return of its own)
    return m.call(0x4f47); // loc_4f47's ret unwinds to loc_4b55's caller
  }
  m.step(0x4bc6, 10); // not taken -> fall through to ret

  m.ret(); // 4bc6  ret
}
