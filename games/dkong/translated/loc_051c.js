// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_051c  (ROM 0x051C–0x055C) — task table entry 0: add to a BCD score.
 *
 *   051c  4f           ld   c,a
 *   051d  cf           rst  0x08
 *   051e  cd 5f 05     call 0x055f
 *   0521  79           ld   a,c
 *   0522  81           add  a,c
 *   0523  81           add  a,c
 *   0524  4f           ld   c,a
 *   0525  21 29 35     ld   hl,0x3529
 *   0528  06 00        ld   b,0x00
 *   052a  09           add  hl,bc
 *   052b  a7           and  a
 *   052c  06 03        ld   b,0x03
 *   052e  1a           ld   a,(de)        ; loop_052e
 *   052f  8e           adc  a,(hl)
 *   0530  27           daa
 *   0531  12           ld   (de),a
 *   0532  13           inc  de
 *   0533  23           inc  hl
 *   0534  10 f8        djnz 0x052e
 *   0536  d5           push de
 *   0537  1b           dec  de
 *   0538  3a 0d 60     ld   a,(0x600d)
 *   053b  cd 6b 05     call 0x056b
 *   053e  d1           pop  de
 *   053f  1b           dec  de
 *   0540  21 ba 60     ld   hl,0x60ba
 *   0543  06 03        ld   b,0x03
 *   0545  1a           ld   a,(de)        ; loop_0545
 *   0546  be           cp   (hl)
 *   0547  d8           ret  c
 *   0548  c2 50 05     jp   nz,0x0550
 *   054b  1b           dec  de
 *   054c  2b           dec  hl
 *   054d  10 f6        djnz 0x0545
 *   054f  c9           ret
 *   0550  cd 5f 05     call 0x055f        ; loc_0550
 *   0553  21 b8 60     ld   hl,0x60b8
 *   0556  1a           ld   a,(de)        ; loop_0556
 *   0557  77           ld   (hl),a
 *   0558  13           inc  de
 *   0559  23           inc  hl
 *   055a  10 fa        djnz 0x0556
 *   055c  c3 da 05     jp   0x05da
 *
 * THREE-BYTE BCD ADD, then a compare-and-maybe-copy against the high score.
 * A carries the task payload in; C holds it, is multiplied by 3, and indexes
 * a table of 3-byte BCD addends at 0x3529.
 *
 * `rst 0x08` AT 0x051D CAN SKIP THIS ENTIRE ROUTINE. sub_0008 discards its own
 * return address when bit 0 of 0x6007 is set, returning to loc_051c's CALLER
 * instead of to 0x051E. Modelled as an early return, which is what sub_0008's
 * boolean is for. A translation calling it and continuing regardless is wrong
 * on that path, and the gate may never see it -- the skip changes WHICH frame
 * resumes, not what memory holds.
 *
 * `and a` AT 0x052B IS LOAD-BEARING AND LOOKS REDUNDANT. It clears CARRY so
 * the `adc a,(hl)` chain starts clean. Deleting it -- it sets no value -- makes
 * the first addend depend on whatever carry `add hl,bc` at 0x052A left, which
 * is a real bit: HL = 0x3529 + 3*payload can carry. This is the flag-liveness
 * shape inverted: usually the risk is assuming flags are dead, here an
 * innocuous-looking instruction exists ONLY for its flag effect.
 *
 * `adc a,(hl)` HAS NO PRECEDENT in games/dkong/translated/ -- an S6 item not on the dispatch.
 * cpu.js's `add(v, carryIn)` was checked against MAME 0.288 z80.cpp:246
 * `adc_a` before use: C from bit 8, H from the low-nibble sum, PV as signed
 * overflow, N cleared. The formulations differ and agree.
 *
 * `daa` AT 0x0530 RUNS WITH N=0 (it follows `adc`). The daa at ROM 0x06B1
 * follows `sub` and runs with N=1, so the two routines exercise OPPOSITE
 * branches of the same helper -- pinned exhaustively against MAME's daa
 * beforehand, all 2048 cases including the 1024 N=1 ones that had never run.
 *
 * B IS CARRIED FROM THE COMPARE LOOP INTO THE COPY LOOP. `jp nz,0x0550` exits
 * mid-loop with B holding the REMAINING count, 0x0550 reloads neither B nor
 * the loop bound, and sub_055f does not touch B -- so the copy at 0x0556 runs
 * exactly as many times as the compare had left. Reloading B to 3 there would
 * be the obvious "fix" and would copy bytes the compare had already cleared.
 *
 * THE TWO LOOPS RUN IN OPPOSITE DIRECTIONS. 0x052E walks UP with `inc de`/
 * `inc hl`; 0x0545 walks DOWN with `dec de`/`dec hl`, which is why 0x0536-
 * 0x053F saves DE, calls the renderer, restores it and decrements twice --
 * repositioning from the low end to the high end. The `push`/`pop` pair
 * brackets a CALL, not a loop.
 *
 * TAIL `jp 0x05da` AT 0x055C -- no return address pushed, so the `ret` that
 * eventually runs is the one belonging to loc_051c's own caller. Enters
 * tail_05da, shared with handler_05c6.
 */
export function loc_051c(m) {
  const { regs, mem } = m;

  regs.c = regs.a; // the task payload
  m.step(0x051d, 4); // ld c,a

  m.push16(0x051e);
  m.step(0x0008, 11); // rst 0x08
  if (!m.call(0x0008)) return; // skipped: sub_0008 returned to OUR caller

  m.push16(0x0521);
  m.step(0x055f, 17); // call 0x055f
  m.call(0x055f); // DE = 0x60B2 or 0x60B5

  regs.a = regs.c;
  m.step(0x0522, 4); // ld a,c
  regs.add(regs.c);
  m.step(0x0523, 4); // add a,c
  regs.add(regs.c);
  m.step(0x0524, 4); // add a,c   -- C * 3
  regs.c = regs.a;
  m.step(0x0525, 4); // ld c,a
  regs.hl = 0x3529;
  m.step(0x0528, 10); // ld hl,0x3529
  regs.b = 0x00;
  m.step(0x052a, 7); // ld b,0x00 -- BC is now the byte offset
  regs.addHl(regs.bc);
  m.step(0x052b, 11); // add hl,bc -- CAN SET CARRY, which is why 0x052B exists
  regs.and(regs.a); // clears carry for the adc chain below
  m.step(0x052c, 4); // and a
  regs.b = 0x03;
  m.step(0x052e, 7); // ld b,0x03

  do {
    regs.a = mem.read8(regs.de);
    m.step(0x052f, 7); // ld a,(de)
    regs.add(mem.read8(regs.hl), regs.fC ? 1 : 0);
    m.step(0x0530, 7); // adc a,(hl)
    regs.daa(); // N = 0 here -- see the note above
    m.step(0x0531, 4); // daa
    mem.write8(regs.de, regs.a);
    m.step(0x0532, 7); // ld (de),a
    regs.de = (regs.de + 1) & 0xffff;
    m.step(0x0533, 6); // inc de -- 16-bit, unlike the inc e family
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x0534, 6); // inc hl
    regs.djnz();
    m.step(regs.b !== 0 ? 0x052e : 0x0536, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);

  m.push16(regs.de); // push de -- brackets the CALL, not a loop
  m.step(0x0537, 11);
  regs.de = (regs.de - 1) & 0xffff;
  m.step(0x0538, 6); // dec de
  regs.a = mem.read8(0x600d);
  m.step(0x053b, 13); // ld a,(0x600d)

  m.push16(0x053e);
  m.step(0x056b, 17); // call 0x056b
  m.call(0x056b);

  regs.de = m.pop16();
  m.step(0x053f, 10); // pop de
  regs.de = (regs.de - 1) & 0xffff;
  m.step(0x0540, 6); // dec de -- now at the HIGH byte, for the downward walk
  regs.hl = 0x60ba;
  m.step(0x0543, 10); // ld hl,0x60ba
  regs.b = 0x03;
  m.step(0x0545, 7); // ld b,0x03

  // The compare walks DOWN from the high byte. Three exits: `ret c` (ours is
  // lower, nothing to do), `jp nz` (ours is higher -- go copy), or the loop
  // running out with all three bytes equal, which falls to the `ret` at 0x054F.
  for (;;) {
    regs.a = mem.read8(regs.de);
    m.step(0x0546, 7); // ld a,(de)
    regs.cp(mem.read8(regs.hl));
    m.step(0x0547, 7); // cp (hl)
    if (regs.fC) {
      m.ret(11); // ret c taken
      return;
    }
    m.step(0x0548, 5); // ret c not taken
    if (regs.fNZ) {
      m.step(0x0550, 10); // jp nz,0x0550 taken -- B keeps the REMAINING count
      break;
    }
    m.step(0x054b, 10); // jp nz not taken
    regs.de = (regs.de - 1) & 0xffff;
    m.step(0x054c, 6); // dec de
    regs.hl = (regs.hl - 1) & 0xffff;
    m.step(0x054d, 6); // dec hl
    regs.djnz();
    m.step(regs.b !== 0 ? 0x0545 : 0x054f, regs.b !== 0 ? 13 : 8);
    if (regs.b === 0) {
      m.ret(); // 054f -- all three bytes equal
      return;
    }
  }

  // loc_0550: ours is higher, so copy it over the high score.
  m.push16(0x0553);
  m.step(0x055f, 17); // call 0x055f -- does NOT touch B
  m.call(0x055f);

  regs.hl = 0x60b8;
  m.step(0x0556, 10); // ld hl,0x60b8

  do {
    regs.a = mem.read8(regs.de);
    m.step(0x0557, 7); // ld a,(de)
    mem.write8(regs.hl, regs.a);
    m.step(0x0558, 7); // ld (hl),a
    regs.de = (regs.de + 1) & 0xffff;
    m.step(0x0559, 6); // inc de
    regs.hl = (regs.hl + 1) & 0xffff;
    m.step(0x055a, 6); // inc hl
    regs.djnz();
    m.step(regs.b !== 0 ? 0x0556 : 0x055c, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);

  m.step(0x05da, 10); // jp 0x05da -- TAIL jump, nothing pushed
  return m.call(0x05da);
}
