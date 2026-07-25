// SPDX-License-Identifier: GPL-3.0-only

/**
 * entry_3ec3  (ROM 0x3EC3–0x3EFE) — 60 bytes, 25 instructions.
 *
 *   3ec3  dd cb 00 46  bit  0,(ix+0x00)   ; loc_3ec3 -- the djnz target
 *   3ec7  ca fa 3e     jp   z,0x3efa      ; inactive -> just advance
 *   3eca  79           ld   a,c
 *   3ecb  dd 96 05     sub  (ix+0x05)
 *   3ece  d2 d3 3e     jp   nc,0x3ed3
 *   3ed1  ed 44        neg                ; |C - (ix+5)|
 *   3ed3  3c           inc  a             ; loc_3ed3
 *   3ed4  95           sub  l
 *   3ed5  da de 3e     jp   c,0x3ede
 *   3ed8  dd 96 0a     sub  (ix+0x0a)
 *   3edb  d2 fa 3e     jp   nc,0x3efa     ; no overlap -> advance
 *   3ede  fd 7e 03     ld   a,(iy+0x03)   ; loc_3ede -- the other axis
 *   3ee1  dd 96 03     sub  (ix+0x03)
 *   3ee4  d2 e9 3e     jp   nc,0x3ee9
 *   3ee7  ed 44        neg
 *   3ee9  94           sub  h             ; loc_3ee9
 *   3eea  da f3 3e     jp   c,0x3ef3
 *   3eed  dd 96 09     sub  (ix+0x09)
 *   3ef0  d2 fa 3e     jp   nc,0x3efa     ; no overlap -> advance
 *   3ef3  3a 60 60     ld   a,(0x6060)    ; loc_3ef3 -- count it
 *   3ef6  3c           inc  a
 *   3ef7  32 60 60     ld   (0x6060),a
 *   3efa  dd 19        add  ix,de         ; loc_3efa -- next object
 *   3efc  10 c5        djnz 0x3ec3
 *   3efe  c9           ret
 *
 * Translated for completeness; not yet wired into the live dispatcher.
 * Not yet wired into the live dispatcher. Calls nothing.
 *
 * A djnz loop over B objects at stride DE from IX. For each ACTIVE object (bit 0
 * of (ix+0x00) set) it takes |C - (ix+0x05)| on one axis and |(iy+0x03) -
 * (ix+0x03)| on the other, compares each against a threshold in L / H and a
 * per-object span in (ix+0x0a) / (ix+0x09), and increments the counter at 0x6060
 * when both axes pass. LIVE-INS: IX (object base), IY, B (count), C, DE (stride),
 * H and L (the thresholds). Fields and 0x6060 not interpreted.
 *
 * Both `neg` sites are the absolute-value idiom: `sub` then, only on borrow,
 * negate -- so the code takes |difference| without a signed compare.
 *
 * S6 measured across the UNION of both trees (per the ruling): (iy+d) 11
 * precedents, neg 4, add ix,de 11 -- but `bit n,(ix+d)` has ZERO in either tree.
 * cpu.js has carried the `yxFrom` parameter for the indexed form since it was
 * pinned for entry_2913, and THIS IS THE FIRST CALL SITE EVER TO USE IT. The
 * indexed form takes F3/F5 from the EFFECTIVE-ADDRESS HIGH BYTE, not from the
 * operand (MAME 0.288 z80.cpp:543), so the EA high byte is passed explicitly.
 * Getting that wrong is invisible in Z -- only F3/F5 differ, and nothing here
 * reads them -- which is exactly why it is passed rather than defaulted.
 */
export function entry_3ec3(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;

  do {
    // loc_3ec3 -- the djnz target
    const ea0 = R(0x00);
    regs.bit(0, mem.read8(ea0), (ea0 >> 8) & 0xff); // INDEXED: F3/F5 from the EA high byte
    m.step(0x3ec7, 20); // bit 0,(ix+0x00)
    if (regs.fZ) {
      m.step(0x3efa, 10); // jp z,0x3efa -- inactive, straight to the advance
    } else {
      m.step(0x3eca, 10); // jp z NOT taken
      regs.a = regs.c;
      m.step(0x3ecb, 4); // ld a,c
      regs.sub(mem.read8(R(0x05)));
      m.step(0x3ece, 19); // sub (ix+0x05)
      if (regs.fNC) {
        m.step(0x3ed3, 10); // jp nc,0x3ed3 -- already non-negative
      } else {
        m.step(0x3ed1, 10); // jp nc NOT taken
        regs.neg(); // absolute value
        m.step(0x3ed3, 8); // neg
      }

      // loc_3ed3
      regs.a = regs.inc8(regs.a);
      m.step(0x3ed4, 4); // inc a
      regs.sub(regs.l);
      m.step(0x3ed5, 4); // sub l
      let axis2 = false;
      if (regs.fC) {
        m.step(0x3ede, 10); // jp c,0x3ede
        axis2 = true;
      } else {
        m.step(0x3ed8, 10); // jp c NOT taken
        regs.sub(mem.read8(R(0x0a)));
        m.step(0x3edb, 19); // sub (ix+0x0a)
        if (regs.fNC) {
          m.step(0x3efa, 10); // jp nc,0x3efa -- no overlap on this axis
        } else {
          m.step(0x3ede, 10); // fall through into loc_3ede
          axis2 = true;
        }
      }

      if (axis2) {
        // loc_3ede -- the second axis
        regs.a = mem.read8((regs.iy + 0x03) & 0xffff);
        m.step(0x3ee1, 19); // ld a,(iy+0x03)
        regs.sub(mem.read8(R(0x03)));
        m.step(0x3ee4, 19); // sub (ix+0x03)
        if (regs.fNC) {
          m.step(0x3ee9, 10); // jp nc,0x3ee9
        } else {
          m.step(0x3ee7, 10); // jp nc NOT taken
          regs.neg();
          m.step(0x3ee9, 8); // neg
        }

        // loc_3ee9
        regs.sub(regs.h);
        m.step(0x3eea, 4); // sub h
        let count = false;
        if (regs.fC) {
          m.step(0x3ef3, 10); // jp c,0x3ef3
          count = true;
        } else {
          m.step(0x3eed, 10); // jp c NOT taken
          regs.sub(mem.read8(R(0x09)));
          m.step(0x3ef0, 19); // sub (ix+0x09)
          if (regs.fNC) {
            m.step(0x3efa, 10); // jp nc,0x3efa -- no overlap
          } else {
            m.step(0x3ef3, 10); // fall through into loc_3ef3
            count = true;
          }
        }

        if (count) {
          // loc_3ef3 -- both axes overlap
          regs.a = mem.read8(0x6060);
          m.step(0x3ef6, 13); // ld a,(0x6060)
          regs.a = regs.inc8(regs.a);
          m.step(0x3ef7, 4); // inc a
          mem.write8(0x6060, regs.a);
          m.step(0x3efa, 13); // ld (0x6060),a
        }
      }
    }

    // loc_3efa -- every path converges here
    regs.addIx(regs.de);
    m.step(0x3efc, 15); // add ix,de
    regs.djnz();
    m.step(regs.b !== 0 ? 0x3ec3 : 0x3efe, regs.b !== 0 ? 13 : 8); // djnz 0x3ec3
  } while (regs.b !== 0);

  m.ret(); // 3efe
}
