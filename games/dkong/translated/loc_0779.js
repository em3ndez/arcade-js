// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0779  (ROM 0x0779–0x07C2) — game state 1, sub-state 0.
 *
 *   0779  21 86 7d     ld   hl,0x7d86
 *   077c  36 00        ld   (hl),0x00
 *   077e  23           inc  hl
 *   077f  36 00        ld   (hl),0x00
 *   0781  11 1b 03     ld   de,0x031b
 *   0784  cd 9f 30     call 0x309f
 *   0787  1c           inc  e
 *   0788  cd 9f 30     call 0x309f
 *   078b  cd 65 09     call 0x0965
 *   078e  21 09 60     ld   hl,0x6009
 *   0791  36 02        ld   (hl),0x02
 *   0793  23           inc  hl
 *   0794  34           inc  (hl)
 *   0795  cd 74 08     call 0x0874
 *   0798  cd 53 0a     call 0x0a53
 *   079b  3a 0f 60     ld   a,(0x600f)
 *   079e  fe 01        cp   0x01
 *   07a0  cc ee 09     call z,0x09ee
 *   07a3  ed 5b 22 60  ld   de,(0x6022)
 *   07a7  21 6c 75     ld   hl,0x756c
 *   07aa  cd ad 07     call 0x07ad
 *   07ad  73           ld   (hl),e
 *   ...
 *
 * Clears BOTH palette-bank bits by walking HL across 0x7D86 and 0x7D87 with
 * `inc hl` -- so the two bits are written by the same two-byte instruction
 * pattern rather than by two absolute stores. Note these are `ld (hl),n`
 * (10 T = 4 fetch + 3 operand + 3 write), so their write bus cycle is at
 * offset 7, NOT the 10 that `ld (nn),a` uses.
 *
 * `call 0x07ad` at 0x07AA calls the instruction IMMEDIATELY FOLLOWING it, so
 * the block at 0x07AD runs once as a subroutine, returns to 0x07AD, and then
 * runs AGAIN as straight-line code -- a two-iteration loop with no loop
 * counter. Translating this as a plain call would execute the body once.
 */
export function loc_0779(m) {
  const { regs, mem } = m;

  regs.hl = 0x7d86;
  m.step(0x077c, 10);
  mem.write8(regs.hl, 0x00, 7); // ld (hl),n -- bus cycle at +7, not +10
  m.step(0x077e, 10);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x077f, 6);
  mem.write8(regs.hl, 0x00, 7);
  m.step(0x0781, 10);

  regs.de = 0x031b;
  m.step(0x0784, 10);
  m.push16(0x0787);
  m.step(0x309f, 17);
  m.call(0x309f);

  regs.e = regs.inc8(regs.e);
  m.step(0x0788, 4);
  m.push16(0x078b);
  m.step(0x309f, 17);
  m.call(0x309f);

  m.push16(0x078e);
  m.step(0x0965, 17);
  m.call(0x0965);

  regs.hl = 0x6009;
  m.step(0x0791, 10);
  mem.write8(regs.hl, 0x02, 7); // ld (hl),n
  m.step(0x0793, 10);
  regs.hl = (regs.hl + 1) & 0xffff;
  m.step(0x0794, 6);
  // `inc (hl)` is a read-modify-write: M1 4 + read 3 + internal 1 = 8 before
  // the write bus cycle, so +8 -- not the +7 of `ld (hl),n` two lines up.
  // Both are "write through HL" and they do NOT share a timestamp. The
  // offset is inert at 0x600A (work RAM is not in the hardware write trace);
  // it is passed for the case where this idiom lands on a latch.
  mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl)), 8);
  m.step(0x0795, 11);

  m.push16(0x0798);
  m.step(0x0874, 17);
  m.call(0x0874);

  m.push16(0x079b);
  m.step(0x0a53, 17);
  m.call(0x0a53);

  regs.a = mem.read8(0x600f);
  m.step(0x079e, 13);
  regs.cp(0x01);
  m.step(0x07a0, 7);
  if (regs.fZ) {
    m.push16(0x07a3);
    m.step(0x09ee, 17);
    m.call(0x09ee);
  } else {
    m.step(0x07a3, 10); // call not taken: 10, not 17
  }

  regs.de = mem.read16(0x6022);
  m.step(0x07a7, 20); // ld de,(nn) is ED-prefixed: 20, not 16
  regs.hl = 0x756c;
  m.step(0x07aa, 10);

  // The two-iteration idiom documented above. Called with (hl,de) set here,
  // then re-entered by FALLING THROUGH into the same bytes with whatever
  // (hl,de) the first pass left behind -- which is why sub_07ad ends by
  // loading them rather than preserving them.
  m.push16(0x07ad);
  m.step(0x07ad, 17);
  m.call(0x07ad);
  m.call(0x07ad);
}
