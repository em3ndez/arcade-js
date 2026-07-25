// SPDX-License-Identifier: GPL-3.0-only

/**
 * entry_2913  (ROM 0x2913–0x2953) — object-list search; A=1+skip on hit, A=0 normal.
 *
 *   2913  dd e5        push ix                ; OUTSIDE the loop
 *   2915  dd cb 00 46  bit  0,(ix+0x00)       ; loop head (djnz target)
 *   2919  ca 4c 29     jp   z,0x294c          ; slot inactive -> next
 *   291c  79           ld   a,c
 *   291d  dd 96 05     sub  (ix+0x05)
 *   2920  d2 25 29     jp   nc,0x2925
 *   2923  ed 44        neg                    ; |C - (ix+5)|
 *   2925  3c           inc  a
 *   2926  95           sub  l
 *   2927  da 30 29     jp   c,0x2930
 *   292a  dd 96 0a     sub  (ix+0x0a)
 *   292d  d2 4c 29     jp   nc,0x294c         ; out of range -> next
 *   2930  fd 7e 03     ld   a,(iy+0x03)
 *   2933  dd 96 03     sub  (ix+0x03)
 *   2936  d2 3b 29     jp   nc,0x293b
 *   2939  ed 44        neg                    ; |(iy+3) - (ix+3)|
 *   293b  94           sub  h
 *   293c  da 45 29     jp   c,0x2945          ; HIT
 *   293f  dd 96 09     sub  (ix+0x09)
 *   2942  d2 4c 29     jp   nc,0x294c         ; out of range -> next
 *   2945  3e 01        ld   a,0x01            ; HIT: A=1 and SKIP a frame
 *   2947  dd e1        pop  ix
 *   2949  33           inc  sp
 *   294a  33           inc  sp
 *   294b  c9           ret                    ; -> caller's CALLER
 *   294c  dd 19        add  ix,de             ; next record
 *   294e  10 c5        djnz 0x2915
 *   2950  af           xor  a                 ; exhausted: A=0
 *   2951  dd e1        pop  ix
 *   2953  c9           ret                    ; -> caller (normal)
 *
 * LIVE-IN: IX (record base), C, L, H, DE (record stride), B (count), IY (0x2930).
 * @returns {boolean} true when control returned NORMALLY (A=0, list exhausted);
 *   false when it SKIPPED a frame (A=1, hit) -- the sub_0008 convention.
 */
export function entry_2913(m) {
  const { regs, mem } = m;

  m.push16(regs.ix); // push ix -- OUTSIDE the loop (djnz targets 0x2915)
  m.step(0x2915, 15);

  for (;;) {
    // `advance` = the ROM's 0x294C target: every "not a match" jump lands there.
    advance: {
      // bit 0,(ix+0x00). F3/F5 come from the EFFECTIVE-ADDRESS HIGH BYTE for the
      // indexed form, not the operand -- that is what cpu.js's `yxFrom` third
      // parameter exists for (it names this call site).
      const ea2915 = (regs.ix + 0x00) & 0xffff;
      regs.bit(0, mem.read8(ea2915), (ea2915 >> 8) & 0xff);
      m.step(0x2919, 20);
      if (regs.fZ) {
        m.step(0x294c, 10); // jp z,0x294c -- slot inactive
        break advance;
      }
      m.step(0x291c, 10);

      regs.a = regs.c;
      m.step(0x291d, 4); // ld a,c
      regs.sub(mem.read8((regs.ix + 0x05) & 0xffff));
      m.step(0x2920, 19); // sub (ix+0x05)
      if (regs.fNC) {
        m.step(0x2925, 10); // jp nc,0x2925
      } else {
        m.step(0x2923, 10);
        regs.neg();
        m.step(0x2925, 8); // neg -- absolute difference
      }

      regs.a = regs.inc8(regs.a);
      m.step(0x2926, 4); // inc a
      regs.sub(regs.l);
      m.step(0x2927, 4); // sub l
      if (regs.fC) {
        m.step(0x2930, 10); // jp c,0x2930 -- within the first span
      } else {
        m.step(0x292a, 10);
        regs.sub(mem.read8((regs.ix + 0x0a) & 0xffff));
        m.step(0x292d, 19); // sub (ix+0x0a)
        if (regs.fNC) {
          m.step(0x294c, 10); // jp nc,0x294c -- out of range
          break advance;
        }
        m.step(0x2930, 10);
      }

      regs.a = mem.read8((regs.iy + 0x03) & 0xffff);
      m.step(0x2933, 19); // ld a,(iy+0x03)
      regs.sub(mem.read8((regs.ix + 0x03) & 0xffff));
      m.step(0x2936, 19); // sub (ix+0x03)
      if (regs.fNC) {
        m.step(0x293b, 10); // jp nc,0x293b
      } else {
        m.step(0x2939, 10);
        regs.neg();
        m.step(0x293b, 8); // neg -- absolute difference
      }

      regs.sub(regs.h);
      m.step(0x293c, 4); // sub h
      if (regs.fC) {
        m.step(0x2945, 10); // jp c,0x2945 -- HIT
      } else {
        m.step(0x293f, 10);
        regs.sub(mem.read8((regs.ix + 0x09) & 0xffff));
        m.step(0x2942, 19); // sub (ix+0x09)
        if (regs.fNC) {
          m.step(0x294c, 10); // jp nc,0x294c -- out of range
          break advance;
        }
        m.step(0x2945, 10); // falls into the HIT exit
      }

      // ---- 0x2945 HIT: A=1, restore IX, DISCARD our return address, ret ----
      regs.a = 0x01;
      m.step(0x2947, 7); // ld a,0x01
      regs.ix = m.pop16();
      m.step(0x2949, 14); // pop ix
      regs.sp = (regs.sp + 1) & 0xffff;
      m.step(0x294a, 6); // inc sp
      regs.sp = (regs.sp + 1) & 0xffff;
      m.step(0x294b, 6); // inc sp -- our return address is now discarded
      m.ret(); // ret -> the CALLER'S CALLER
      return false; // SKIPPED (sub_0008 convention)
    }

    // ---- 0x294C: advance to the next record and loop ----
    regs.addIx(regs.de);
    m.step(0x294e, 15); // add ix,de
    regs.djnz();
    m.step(regs.b !== 0 ? 0x2915 : 0x2950, regs.b !== 0 ? 13 : 8);
    if (regs.b === 0) break; // B==0 on entry would give 256 passes; the ROM does not guard it
  }

  // ---- 0x2950: list exhausted -- A=0, restore IX, NORMAL return ----
  regs.xor(regs.a);
  m.step(0x2951, 4); // xor a
  regs.ix = m.pop16();
  m.step(0x2953, 14); // pop ix
  m.ret(); // ret -> the caller
  return true; // returned NORMALLY (sub_0008 convention)
}
