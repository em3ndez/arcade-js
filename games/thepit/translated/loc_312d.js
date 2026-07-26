// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_312d  (ROM 0x312D–0x316C) — the object-1 half of the two-object
 * move/collision + sprite-record pass; delegates object 2 to loc_316f.
 *
 * Gated on a phase/level counter at 0x8010: if it is below 8 the whole pass is
 * skipped (tail-jump straight to 0x3748). Otherwise it (1) copies object 1's
 * 17-byte live record into the shared scratch buffer 0x8083, (2) calls loc_319d
 * to run that object's movement/collision, (3) copies the updated scratch back
 * over the object record, then (4) copies the record's first 3 bytes into sprite
 * record 0x8230 and appends a 4th byte = record[3] biased by (0x8051). It then
 * decides whether object 2 runs: when 0x8001==4 and 0x8010<0x0a only object 1
 * runs, so it bails to 0x3748; otherwise it hands off to loc_316f, which does
 * the identical pass for object 2 (source 0x80f9, sprite record 0x8234).
 *
 * This routine has NO `ret`: both `jp c,0x3748` exits and the hand-off to
 * loc_316f are jumps that discard loc_312d's frame. 0x3748 is a TAIL-JUMP
 * (`return m.call(0x3748)`, whose own ret returns to loc_312d's caller). loc_316f
 * is its OWN registered routine (0x316f is reached only here — via the `jr nz`
 * and the `jp c` fall-through — but it is translated as a separate file, so this
 * routine STOPS at 0x316c and DELEGATES with `return m.call(0x316f)` rather than
 * inlining its bytes; loc_316f in turn tail-jumps to 0x3748 and thus returns to
 * loc_312d's caller). The one regular `call 0x319d` pushes its return (0x3143)
 * and resumes in-line.
 *
 *   312d  3a 10 80     ld   a,(0x8010)
 *   3130  fe 08        cp   0x08
 *   3132  da 48 37     jp   c,0x3748       ; skip both objects when 0x8010 < 8
 *   3135  21 e8 80     ld   hl,0x80e8      ; object 1 record -> scratch
 *   3138  11 83 80     ld   de,0x8083
 *   313b  01 11 00     ld   bc,0x0011
 *   313e  ed b0        ldir
 *   3140  cd 9d 31     call 0x319d         ; run object 1 movement/collision
 *   3143  21 83 80     ld   hl,0x8083      ; scratch -> object 1 record
 *   3146  11 e8 80     ld   de,0x80e8
 *   3149  01 11 00     ld   bc,0x0011
 *   314c  ed b0        ldir
 *   314e  11 30 82     ld   de,0x8230      ; sprite record 1
 *   3151  21 e8 80     ld   hl,0x80e8
 *   3154  01 03 00     ld   bc,0x0003
 *   3157  ed b0        ldir                ; 3 bytes 0x80e8..0x80ea -> 0x8230..0x8232
 *   3159  3a 51 80     ld   a,(0x8051)     ; the shared bias
 *   315c  47           ld   b,a
 *   315d  7e           ld   a,(hl)         ; A = object1[3] (HL = 0x80eb)
 *   315e  80           add  a,b            ; A = object1[3] + bias
 *   315f  12           ld   (de),a         ; -> sprite1[3] (0x8233)
 *   3160  3a 01 80     ld   a,(0x8001)
 *   3163  fe 04        cp   0x04
 *   3165  20 08        jr   nz,0x316f      ; if 0x8001 != 4 -> object 2 (loc_316f)
 *   3167  3a 10 80     ld   a,(0x8010)
 *   316a  fe 0a        cp   0x0a
 *   316c  da 48 37     jp   c,0x3748       ; 0x8001==4 && 0x8010<0x0a -> stop after obj 1
 *                                          ; else fall through into loc_316f (object 2)
 */
export function loc_312d(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8010);
  m.step(0x3130, 13); // ld a,(0x8010) -- phase/level gate

  regs.cp(0x08);
  m.step(0x3132, 7); // cp 0x08

  if (regs.fC) { m.step(0x3748, 10); return m.call(0x3748); } // jp c,0x3748 -- skip when < 8
  m.step(0x3135, 10);

  regs.hl = 0x80e8;
  m.step(0x3138, 10); // ld hl,0x80e8 -- object 1 record

  regs.de = 0x8083;
  m.step(0x313b, 10); // ld de,0x8083 -- scratch

  regs.bc = 0x0011;
  m.step(0x313e, 10); // ld bc,0x0011 -- PC now at the ldir

  m.ldirAt(0x313e, 0x3140); // ldir -- 17 bytes 0x80e8.. -> 0x8083..; HL=0x80f9, DE=0x8094, BC=0

  m.push16(0x3143);
  m.step(0x319d, 17);
  m.call(0x319d); // call 0x319d -- run object 1 movement/collision (resumes in-line)

  regs.hl = 0x8083;
  m.step(0x3146, 10); // ld hl,0x8083 -- scratch

  regs.de = 0x80e8;
  m.step(0x3149, 10); // ld de,0x80e8 -- object 1 record

  regs.bc = 0x0011;
  m.step(0x314c, 10); // ld bc,0x0011 -- PC now at the ldir

  m.ldirAt(0x314c, 0x314e); // ldir -- 17 bytes back; HL=0x8094, DE=0x80f9, BC=0

  regs.de = 0x8230;
  m.step(0x3151, 10); // ld de,0x8230 -- sprite record 1

  regs.hl = 0x80e8;
  m.step(0x3154, 10); // ld hl,0x80e8

  regs.bc = 0x0003;
  m.step(0x3157, 10); // ld bc,0x0003 -- PC now at the ldir

  m.ldirAt(0x3157, 0x3159); // ldir -- 3 bytes 0x80e8..0x80ea -> 0x8230..0x8232; HL=0x80eb, DE=0x8233

  regs.a = mem.read8(0x8051);
  m.step(0x315c, 13); // ld a,(0x8051) -- the bias

  regs.b = regs.a;
  m.step(0x315d, 4); // ld b,a -- B = bias

  regs.a = mem.read8(regs.hl);
  m.step(0x315e, 7); // ld a,(hl) -- A = object1[3]

  regs.add(regs.b);
  m.step(0x315f, 4); // add a,b -- A = object1[3] + bias

  mem.write8(regs.de, regs.a);
  m.step(0x3160, 7); // ld (de),a -- sprite1[3] (0x8233)

  regs.a = mem.read8(0x8001);
  m.step(0x3163, 13); // ld a,(0x8001)

  regs.cp(0x04);
  m.step(0x3165, 7); // cp 0x04

  if (regs.fNZ) { m.step(0x316f, 12); return m.call(0x316f); } // jr nz,0x316f -> object 2
  m.step(0x3167, 7);

  regs.a = mem.read8(0x8010);
  m.step(0x316a, 13); // ld a,(0x8010)

  regs.cp(0x0a);
  m.step(0x316c, 7); // cp 0x0a

  if (regs.fC) { m.step(0x3748, 10); return m.call(0x3748); } // jp c,0x3748 -- stop after object 1
  m.step(0x316f, 10); // jp c not taken -- PC falls through to 0x316f

  return m.call(0x316f); // fall through into loc_316f (object 2); its tail-jump returns to OUR caller
}
