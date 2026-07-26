// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_316f  (ROM 0x316f-0x319c, The Pit) -- the "test move" variant of the object
 * update at loc_3143: it copies the live object record 0x80f9 into the scratch slot
 * 0x8083, runs the collision/move probe loc_319d against that scratch copy, then
 * copies the (possibly-updated) scratch record BACK into 0x80f9. Finally it appends
 * a 3-byte display record at 0x8234 -- the first 3 bytes of 0x80f9 verbatim plus a
 * 4th byte biased by (0x8051) -- and tail-jumps into the shared render/continue tail
 * at 0x3748.
 *
 * Structure (addresses/arithmetic/branch senses exact; role labels best-effort):
 *   - ldir 0x80f9 -> 0x8083, 0x11 bytes   ; stage the object record into the scratch slot
 *   - call 0x319d                         ; probe/advance the object using the scratch copy
 *                                           (resumes in-line; its ret pops 0x317d)
 *   - ldir 0x8083 -> 0x80f9, 0x11 bytes   ; copy the scratch record back over the live one
 *   - ldir 0x80f9 -> 0x8234, 0x03 bytes   ; emit the 3-byte display record (leaves HL=0x80fc)
 *   - b = (0x8051); a = (hl)=0x80fc[record[3]]; a += b; (de)=0x8237 = record[3] + (0x8051)
 *   - jp 0x3748                           ; TAIL-JUMP into the render/continue tail
 *
 * Same idiom as loc_3143 (its non-taken `jr nz` fall-through IS this routine), and the
 * same biased-4th-byte trailer as loc_3a4c: the 3 verbatim bytes go through ldir, the
 * 4th is source[3] + the shared bias at 0x8051.
 *
 * The final `jp 0x3748` discards no state loc_316f still needs, so it is a TAIL-JUMP:
 * 0x3748's own `ret` returns to loc_316f's caller. Modelled `m.step(0x3748, 10);
 * return m.call(0x3748)` with NO trailing m.ret (a second ret would double-pop). The
 * one regular `call 0x319d` pushes its own return address (0x317d) and resumes in-line.
 *
 *   316f  21 f9 80     ld   hl,0x80f9
 *   3172  11 83 80     ld   de,0x8083
 *   3175  01 11 00     ld   bc,0x0011
 *   3178  ed b0        ldir                 ; 0x80f9..0x8109 -> 0x8083..0x8093
 *   317a  cd 9d 31     call 0x319d
 *   317d  21 83 80     ld   hl,0x8083
 *   3180  11 f9 80     ld   de,0x80f9
 *   3183  01 11 00     ld   bc,0x0011
 *   3186  ed b0        ldir                 ; 0x8083..0x8093 -> 0x80f9..0x8109
 *   3188  11 34 82     ld   de,0x8234
 *   318b  21 f9 80     ld   hl,0x80f9
 *   318e  01 03 00     ld   bc,0x0003
 *   3191  ed b0        ldir                 ; 0x80f9..0x80fb -> 0x8234..0x8236 (HL->0x80fc)
 *   3193  3a 51 80     ld   a,(0x8051)      ; the shared bias
 *   3196  47           ld   b,a             ; B = bias
 *   3197  7e           ld   a,(hl)          ; A = record[3] (HL = 0x80fc)
 *   3198  80           add  a,b             ; A = record[3] + bias
 *   3199  12           ld   (de),a          ; -> 0x8237 (DE = 0x8237)
 *   319a  c3 48 37     jp   0x3748
 */
export function loc_316f(m) {
  const { regs, mem } = m;

  // -- stage the live object record into the scratch slot ----------------------
  regs.hl = 0x80f9;
  m.step(0x3172, 10); // 316f  ld hl,0x80f9 -- source: live object record

  regs.de = 0x8083;
  m.step(0x3175, 10); // 3172  ld de,0x8083 -- dest: scratch record

  regs.bc = 0x0011;
  m.step(0x3178, 10); // 3175  ld bc,0x0011 -- PC now at the ldir

  m.ldirAt(0x3178, 0x317a); // 3178  ldir -- 0x11 bytes; leaves HL=0x810a, DE=0x8094, BC=0

  // -- probe/advance the object using the scratch copy -------------------------
  m.push16(0x317d);
  m.step(0x319d, 17); // 317a  call 0x319d -- resumes in-line; its ret pops 0x317d
  m.call(0x319d);

  // -- copy the (possibly-updated) scratch record back over the live one -------
  regs.hl = 0x8083;
  m.step(0x3180, 10); // 317d  ld hl,0x8083 -- source: scratch record

  regs.de = 0x80f9;
  m.step(0x3183, 10); // 3180  ld de,0x80f9 -- dest: live object record

  regs.bc = 0x0011;
  m.step(0x3186, 10); // 3183  ld bc,0x0011 -- PC now at the ldir

  m.ldirAt(0x3186, 0x3188); // 3186  ldir -- 0x11 bytes; leaves HL=0x8094, DE=0x810a, BC=0

  // -- emit the 3-byte display record + biased 4th byte ------------------------
  regs.de = 0x8234;
  m.step(0x318b, 10); // 3188  ld de,0x8234 -- dest: display record

  regs.hl = 0x80f9;
  m.step(0x318e, 10); // 318b  ld hl,0x80f9 -- source: live object record

  regs.bc = 0x0003;
  m.step(0x3191, 10); // 318e  ld bc,0x0003 -- PC now at the ldir

  m.ldirAt(0x3191, 0x3193); // 3191  ldir -- 3 bytes; leaves HL=0x80fc, DE=0x8237, BC=0

  regs.a = mem.read8(0x8051);
  m.step(0x3196, 13); // 3193  ld a,(0x8051) -- the shared bias

  regs.b = regs.a;
  m.step(0x3197, 4); // 3196  ld b,a -- B = bias

  regs.a = mem.read8(regs.hl);
  m.step(0x3198, 7); // 3197  ld a,(hl) -- A = record[3] (HL = 0x80fc)

  regs.add(regs.b);
  m.step(0x3199, 4); // 3198  add a,b -- A = record[3] + bias

  mem.write8(regs.de, regs.a);
  m.step(0x319a, 7); // 3199  ld (de),a -- store the biased 4th byte at 0x8237

  // 319a  jp 0x3748 -- TAIL-JUMP: 0x3748's ret returns to loc_316f's caller.
  m.step(0x3748, 10);
  return m.call(0x3748);
}
