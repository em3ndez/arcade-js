// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_09ab  (ROM 0x09AB–0x09D5) — copy 8 bytes, deref a pointer, arm state.
 *
 *   09ab  21 40 60     ld   hl,0x6040
 *   09ae  11 28 62     ld   de,0x6228
 *   09b1  01 08 00     ld   bc,0x0008
 *   09b4  ed b0        ldir                 ; 0x6040..0x6047 -> 0x6228..0x622F
 *   09b6  2a 2a 62     ld   hl,(0x622a)     ; INDIRECT -- the word AT 0x622A
 *   09b9  7e           ld   a,(hl)
 *   09ba  32 27 62     ld   (0x6227),a
 *   09bd  3a 0f 60     ld   a,(0x600f)
 *   09c0  a7           and  a               ; Z iff 0x600F == 0
 *   09c1  21 09 60     ld   hl,0x6009
 *   09c4  11 0a 60     ld   de,0x600a
 *   09c7  ca d0 09     jp   z,0x09d0        ; ==0 -> (1,5) ; else (0x78,2)
 *   09ca  36 78        ld   (hl),0x78
 *   09cc  eb           ex   de,hl
 *   09cd  36 02        ld   (hl),0x02
 *   09cf  c9           ret
 *   09d0  36 01        ld   (hl),0x01       ; loc_09d0
 *   09d2  eb           ex   de,hl
 *   09d3  36 05        ld   (hl),0x05
 *   09d5  c9           ret
 */
export function loc_09ab(m) {
  const { regs, mem } = m;

  regs.hl = 0x6040;
  m.step(0x09ae, 10); // ld hl,0x6040
  regs.de = 0x6228;
  m.step(0x09b1, 10); // ld de,0x6228
  regs.bc = 0x0008;
  m.step(0x09b4, 10); // ld bc,0x0008
  m.ldir(0x09b6); // ldir -- copies 8 bytes 0x6040 -> 0x6228

  regs.hl = mem.read16(0x622a); // INDIRECT: HL = the word AT 0x622A
  m.step(0x09b9, 16); // ld hl,(0x622a)
  regs.a = mem.read8(regs.hl); // deref
  m.step(0x09ba, 7); // ld a,(hl)
  mem.write8(0x6227, regs.a);
  m.step(0x09bd, 13); // ld (0x6227),a

  regs.a = mem.read8(0x600f);
  m.step(0x09c0, 13); // ld a,(0x600f)
  regs.and(regs.a); // and a -- Z iff 0x600F == 0
  m.step(0x09c1, 4);
  regs.hl = 0x6009;
  m.step(0x09c4, 10); // ld hl,0x6009
  regs.de = 0x600a;
  m.step(0x09c7, 10); // ld de,0x600a

  if (regs.fZ) {
    // -- loc_09d0 -- 0x600F == 0
    m.step(0x09d0, 10); // jp z,0x09d0
    mem.write8(regs.hl, 0x01); // 0x6009 = 1
    m.step(0x09d2, 10); // ld (hl),0x01
    regs.exDeHl(); // HL = 0x600A
    m.step(0x09d3, 4); // ex de,hl
    mem.write8(regs.hl, 0x05); // 0x600A = 5
    m.step(0x09d5, 10); // ld (hl),0x05
    m.ret(); // ret (0x09D5)
    return;
  }
  m.step(0x09ca, 10); // jp z NOT taken

  mem.write8(regs.hl, 0x78); // 0x6009 = 0x78
  m.step(0x09cc, 10); // ld (hl),0x78
  regs.exDeHl(); // HL = 0x600A
  m.step(0x09cd, 4); // ex de,hl
  mem.write8(regs.hl, 0x02); // 0x600A = 2
  m.step(0x09cf, 10); // ld (hl),0x02
  m.ret(); // ret (0x09CF)
}
