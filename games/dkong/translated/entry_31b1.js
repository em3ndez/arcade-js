// SPDX-License-Identifier: GPL-3.0-only

/**
 * entry_31b1  (ROM 0x31B1–0x31DC) — loop over 5 strided objects, process each.
 *
 *   31b1  cd dd 31     call 0x31dd        ; init/mode-setup
 *   31b4  af           xor  a
 *   31b5  32 a2 63     ld   (0x63a2),a    ; counter = 0
 *   31b8  21 e0 63     ld   hl,0x63e0
 *   31bb  22 c8 63     ld   (0x63c8),hl   ; pointer = 0x63E0 (in MEMORY)
 *   31be  2a c8 63     ld   hl,(0x63c8)   ; loc_31be -- load pointer
 *   31c1  01 20 00     ld   bc,0x0020
 *   31c4  09           add  hl,bc         ; advance BEFORE the read
 *   31c5  22 c8 63     ld   (0x63c8),hl   ; STORE BACK -- 0x3202 reads 0x63c8
 *   31c8  7e           ld   a,(hl)
 *   31c9  a7           and  a
 *   31ca  ca d0 31     jp   z,0x31d0      ; empty object -> skip the call
 *   31cd  cd 02 32     call 0x3202        ; process non-empty object
 *   31d0  3a a2 63     ld   a,(0x63a2)    ; loc_31d0
 *   31d3  3c           inc  a
 *   31d4  32 a2 63     ld   (0x63a2),a
 *   31d7  fe 05        cp   0x05
 *   31d9  c2 be 31     jp   nz,0x31be     ; loop while counter != 5
 *   31dc  c9           ret
 *
 * Translated for completeness; not yet wired into the live dispatcher.
 * Not yet wired into the live dispatcher: called from 0x30F3 (entry_30ed, untranslated);
 * nothing in translated src invokes entry_31b1.
 *
 * Walks 5 objects at stride 0x20 (processed addresses 0x6400/20/40/60/80 -- the
 * add hl,0x20 PRECEDES the read, so the 0x63E0 base is never read), calling
 * entry_3202 for each whose first byte is non-zero. NOT a stack splice.
 *
 * THE POINTER STORE-BACK IS LOAD-BEARING: the iteration pointer lives at
 * 0x63C8, not a register. The `ld (0x63c8),hl` at 0x31C5 hands the current object
 * pointer to entry_3202 THROUGH MEMORY -- entry_3202's first act is
 * `ld ix,(0x63c8)`. Keeping the pointer only in HL would leave 0x63C8 stale and
 * entry_3202 would process the wrong cell every iteration.
 *
 * Both callees return NORMALLY (verified: sub_31dd and entry_3202 are neither
 * skip-capable nor boolean-returning), so both are plain calls. The `jp nz`
 * loop-back at 0x31D9 charges its own 10T to 0x31BE (a faithful loop, not a
 * bare do-while). 0x63A2 counter / 0x63C8 pointer / object meaning not
 * interpreted.
 */
export function entry_31b1(m) {
  const { regs, mem } = m;

  m.push16(0x31b4);
  m.step(0x31dd, 17); // call 0x31dd -- init/mode-setup
  m.call(0x31dd);

  regs.xor(regs.a);
  m.step(0x31b5, 4); // xor a
  mem.write8(0x63a2, regs.a);
  m.step(0x31b8, 13); // ld (0x63a2),a -- counter = 0
  regs.hl = 0x63e0;
  m.step(0x31bb, 10); // ld hl,0x63e0
  mem.write16(0x63c8, regs.hl);
  m.step(0x31be, 16); // ld (0x63c8),hl -- pointer = 0x63E0

  for (;;) {
    // loc_31be -- top of the 5-object loop
    regs.hl = mem.read16(0x63c8);
    m.step(0x31c1, 16); // ld hl,(0x63c8)
    regs.bc = 0x0020;
    m.step(0x31c4, 10); // ld bc,0x0020
    regs.addHl(regs.bc);
    m.step(0x31c5, 11); // add hl,bc -- advance BEFORE the read
    mem.write16(0x63c8, regs.hl);
    m.step(0x31c8, 16); // ld (0x63c8),hl -- STORE BACK (entry_3202 reads 0x63c8)
    regs.a = mem.read8(regs.hl);
    m.step(0x31c9, 7); // ld a,(hl)
    regs.and(regs.a);
    m.step(0x31ca, 4); // and a
    if (regs.fZ) {
      m.step(0x31d0, 10); // jp z,0x31d0 taken -- empty object, skip
    } else {
      m.step(0x31cd, 10); // jp z NOT taken -- non-empty
      m.push16(0x31d0);
      m.step(0x3202, 17); // call 0x3202
      m.call(0x3202);
    }

    // loc_31d0
    regs.a = mem.read8(0x63a2);
    m.step(0x31d3, 13); // ld a,(0x63a2)
    regs.a = regs.inc8(regs.a);
    m.step(0x31d4, 4); // inc a
    mem.write8(0x63a2, regs.a);
    m.step(0x31d7, 13); // ld (0x63a2),a
    regs.cp(0x05);
    m.step(0x31d9, 7); // cp 0x05
    if (regs.fNZ) {
      m.step(0x31be, 10); // jp nz,0x31be taken -- loop while counter != 5
      continue;
    }
    m.step(0x31dc, 10); // jp nz NOT taken -- fall to ret
    break;
  }

  m.ret(); // 31dc
}
