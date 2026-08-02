// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_3478  (ROM 0x3478–0x34B8) — 65 bytes, 22 instructions.
 *
 *   3478  dd 6e 1a     ld   l,(ix+0x1a)
 *   347b  dd 66 1b     ld   h,(ix+0x1b)
 *   347e  af           xor  a
 *   347f  01 00 00     ld   bc,0x0000
 *   3482  ed 4a        adc  hl,bc           ; same zero test as sub_342c
 *   3484  c2 9a 34     jp   nz,0x349a
 *   3487  21 ac 3a     ld   hl,0x3aac       ; DIFFERENT table from sub_342c's 0x3A8C
 *   348a  3a 03 62     ld   a,(0x6203)
 *   348d  cb 7f        bit  7,a             ; direction select
 *   348f  ca a8 34     jp   z,0x34a8
 *   3492  dd 36 0d 01  ld   (ix+0x0d),0x01  ; forward
 *   3496  dd 36 03 7e  ld   (ix+0x03),0x7e
 *   349a  dd 7e 0d     ld   a,(ix+0x0d)     ; loc_349a
 *   349d  fe 01        cp   0x01
 *   349f  c2 b3 34     jp   nz,0x34b3
 *   34a2  dd 34 03     inc  (ix+0x03)       ; forward: index up
 *   34a5  c3 45 34     jp   0x3445          ; TAIL JUMP into sub_342c's tail
 *   34a8  dd 36 0d 02  ld   (ix+0x0d),0x02  ; loc_34a8 -- backward
 *   34ac  dd 36 03 80  ld   (ix+0x03),0x80
 *   34b0  c3 9a 34     jp   0x349a
 *   34b3  dd 35 03     dec  (ix+0x03)       ; loc_34b3 -- backward: index down
 *   34b6  c3 45 34     jp   0x3445          ; TAIL JUMP
 *
 * Translated for completeness; not yet wired into the live dispatcher.
 * Not yet wired into the live dispatcher: called from 0x32D2 (sub_32bd, untranslated).
 * IX live-in.
 *
 * THE TWIN OF sub_342c -- WRITTEN FROM ITS OWN BYTES, NOT FROM 342c (S7). The
 * two share the pointer zero-test prefix instruction-for-instruction, but differ
 * in the middle: sub_342c uses table 0x3A8C with a flat `(ix+0x03)=0x26, inc`;
 * loc_3478 uses table 0x3AAC and a DIRECTION STATE MACHINE keyed on bit 7 of
 * 0x6203 -- forward sets (ix+0x0d)=1 and base 0x7E and INCREMENTS the index,
 * backward sets (ix+0x0d)=2 and base 0x80 and DECREMENTS it. Reusing 342c's init
 * here would be silently wrong on both the table and the direction.
 *
 * IT HAS NO `ret`. Both exits (0x34A5, 0x34B6) are `jp 0x3445`, jumping INTO
 * sub_342c's shared loc_3445 tail with NOTHING pushed -- so loc_3445's ret
 * returns to loc_3478's OWN caller. Modelled `m.step(0x3445, 10); return
 * m.call(0x3445)`. Treating either exit as a call (push + ret) would splice a
 * phantom frame; treating it as a duplicated tail would double the code the ROM
 * shares. Note a `jp` into a shared tail never appears in a call-graph walk,
 * so this edge is invisible to exactly the tooling used to find callees --
 * second instance of the shape after loc_0038/sub_003d.
 *
 * 0x6203 / the tables / the direction meaning are not interpreted.
 */
export function loc_3478(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;

  regs.l = mem.read8(R(0x1a));
  m.step(0x347b, 19); // ld l,(ix+0x1a)
  regs.h = mem.read8(R(0x1b));
  m.step(0x347e, 19); // ld h,(ix+0x1b)
  regs.xor(regs.a); // xor a -- A = 0, carry CLEARED for the adc
  m.step(0x347f, 4); // xor a
  regs.bc = 0x0000;
  m.step(0x3482, 10); // ld bc,0x0000
  regs.adcHl(regs.bc); // adc hl,bc -- Z iff the saved pointer is zero
  m.step(0x3484, 15); // adc hl,bc
  if (regs.fNZ) {
    m.step(0x349a, 10); // jp nz,0x349a TAKEN -- continue an existing walk
  } else {
    m.step(0x3487, 10); // jp nz NOT taken -- reinitialise
    regs.hl = 0x3aac; // NOT 0x3A8C -- this twin's own table
    m.step(0x348a, 10); // ld hl,0x3aac
    regs.a = mem.read8(0x6203);
    m.step(0x348d, 13); // ld a,(0x6203)
    regs.bit(7, regs.a); // sets Z = !bit7
    m.step(0x348f, 8); // bit 7,a
    if (regs.fZ) {
      // loc_34a8 -- bit 7 CLEAR: backward
      m.step(0x34a8, 10); // jp z,0x34a8 TAKEN
      mem.write8(R(0x0d), 0x02);
      m.step(0x34ac, 19); // ld (ix+0x0d),0x02
      mem.write8(R(0x03), 0x80);
      m.step(0x34b0, 19); // ld (ix+0x03),0x80
      m.step(0x349a, 10); // jp 0x349a
    } else {
      m.step(0x3492, 10); // jp z NOT taken -- bit 7 SET: forward
      mem.write8(R(0x0d), 0x01);
      m.step(0x3496, 19); // ld (ix+0x0d),0x01
      mem.write8(R(0x03), 0x7e);
      m.step(0x349a, 19); // ld (ix+0x03),0x7e
    }
  }

  // loc_349a -- direction dispatch
  regs.a = mem.read8(R(0x0d));
  m.step(0x349d, 19); // ld a,(ix+0x0d)
  regs.cp(0x01);
  m.step(0x349f, 7); // cp 0x01
  if (regs.fNZ) {
    // loc_34b3 -- backward
    m.step(0x34b3, 10); // jp nz,0x34b3 TAKEN
    regs.decMem8(mem, R(0x03)); // dec (ix+0x03)
    m.step(0x34b6, 23); // dec (ix+0x03)
    m.step(0x3445, 10); // jp 0x3445 -- TAIL JUMP, nothing pushed
    return m.call(0x3445);
  }
  m.step(0x34a2, 10); // jp nz NOT taken -- forward
  regs.incMem8(mem, R(0x03)); // inc (ix+0x03)
  m.step(0x34a5, 23); // inc (ix+0x03)
  m.step(0x3445, 10); // jp 0x3445 -- TAIL JUMP, nothing pushed
  return m.call(0x3445);
}
