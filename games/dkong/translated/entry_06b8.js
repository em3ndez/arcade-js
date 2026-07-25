// SPDX-License-Identifier: GPL-3.0-only

/**
 * entry_06b8  (ROM 0x06B8–0x06FD) — task 6 of the 0x0307 table: redraws the lives indicator and the level digits.
 *
 *   06b8  4f           ld   c,a
 *   06b9  cf           rst  0x08
 *   06ba  06 06        ld   b,0x06
 *   06bc  11 e0 ff     ld   de,0xffe0
 *   06bf  21 83 77     ld   hl,0x7783
 *   06c2  36 10        ld   (hl),0x10        ; loc_06c2
 *   06c4  19           add  hl,de
 *   06c5  10 fb        djnz 0x06c2
 *   06c7  3a 28 62     ld   a,(0x6228)
 *   06ca  91           sub  c
 *   06cb  ca d7 06     jp   z,0x06d7
 *   06ce  47           ld   b,a
 *   06cf  21 83 77     ld   hl,0x7783
 *   06d2  36 ff        ld   (hl),0xff        ; loc_06d2
 *   06d4  19           add  hl,de
 *   06d5  10 fb        djnz 0x06d2
 *   06d7  21 03 75     ld   hl,0x7503        ; loc_06d7
 *   06da  36 1c        ld   (hl),0x1c
 *   06dc  21 e3 74     ld   hl,0x74e3
 *   06df  36 34        ld   (hl),0x34
 *   06e1  3a 29 62     ld   a,(0x6229)
 *   06e4  fe 64        cp   0x64
 *   06e6  38 05        jr   c,0x06ed
 *   06e8  3e 63        ld   a,0x63
 *   06ea  32 29 62     ld   (0x6229),a
 *   06ed  01 0a ff     ld   bc,0xff0a        ; loc_06ed
 *   06f0  04           inc  b                ; loc_06f0
 *   06f1  91           sub  c
 *   06f2  d2 f0 06     jp   nc,0x06f0
 *   06f5  81           add  a,c
 *   06f6  32 a3 74     ld   (0x74a3),a
 *   06f9  78           ld   a,b
 *   06fa  32 c3 74     ld   (0x74c3),a
 *   06fd  c9           ret
 *
 * Redraws the lives indicator: blanks six cells (tile 0x10) stepping one
 * tilemap row back each time, then fills 0xFF markers for the current life
 * count, then two fixed tiles.
 *
 * The tail (0x06E1-0x06FD) clamps the level number at 0x6229 to 0x63 and
 * splits it into two decimal digits by REPEATED SUBTRACTION, not DAA: B
 * starts at 0xFF and `inc b` runs before the first `sub c`, so B counts how
 * many times 10 was subtracted while the result stayed non-negative. The
 * final `add a,c` undoes the subtraction that borrowed. Tens go to 0x74C3,
 * units to 0x74A3 -- adjacent tilemap columns 32 apart.
 */
export function entry_06b8(m) {
  const { regs, mem } = m;

  regs.c = regs.a;
  m.step(0x06b9, 4);

  m.push16(0x06ba);
  m.step(0x0008, 11); // rst 0x08
  // NOT a skip signal -- the previous `return false` here was a SCOPE ERROR.
  // sub_0008's FALSE truthfully asserts "I consumed MY caller's continuation",
  // and MY caller is entry_06b8 -- so re-emitting that value verbatim made
  // entry_06b8 assert it about ITS caller, where it is false. A predicate that
  // is true about me is not automatically true about my caller.
  //
  // Trace: handler_01c3's `call 0x06b8` pushes 0x01DF; this rst pushes 0x06BA;
  // sub_0008's skip arm discards 0x06BA and rets to 0x01DF -- handler_01c3's OWN
  // continuation, exactly where our own `ret` would have gone. The same holds
  // for sub_0350's tail jump (nothing pushed, so the skip lands at sub_0350's
  // return address). In BOTH entry modes the skip merely cuts THIS body short;
  // the caller always continues. So the answer to "should my caller continue?"
  // is always YES.
  //
  // Returns TRUE rather than going void deliberately: with TRUE a future
  // erroneous `if (!entry_06b8(m)) return;` is INERT, whereas undefined is
  // falsy and would make that same mistake a LIVE defect. DO NOT add a guard
  // at the callers.
  if (!m.call(0x0008)) return true;

  regs.b = 0x06;
  m.step(0x06bc, 7);
  regs.de = 0xffe0;
  m.step(0x06bf, 10);
  regs.hl = 0x7783;
  m.step(0x06c2, 10);
  do {
    mem.write8(regs.hl, 0x10);
    m.step(0x06c4, 10);
    regs.addHl(regs.de);
    m.step(0x06c5, 11);
    regs.djnz();
    m.step(regs.b !== 0 ? 0x06c2 : 0x06c7, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);

  regs.a = mem.read8(0x6228);
  m.step(0x06ca, 13);
  regs.sub(regs.c);
  m.step(0x06cb, 4);
  if (!regs.fZ) {
    m.step(0x06ce, 10); // jp z not taken
    regs.b = regs.a;
    m.step(0x06cf, 4);
    regs.hl = 0x7783;
    m.step(0x06d2, 10);
    do {
      mem.write8(regs.hl, 0xff);
      m.step(0x06d4, 10);
      regs.addHl(regs.de);
      m.step(0x06d5, 11);
      regs.djnz();
      m.step(regs.b !== 0 ? 0x06d2 : 0x06d7, regs.b !== 0 ? 13 : 8);
    } while (regs.b !== 0);
  } else {
    m.step(0x06d7, 10);
  }

  // loc_06d7
  regs.hl = 0x7503;
  m.step(0x06da, 10);
  mem.write8(regs.hl, 0x1c);
  m.step(0x06dc, 10);
  regs.hl = 0x74e3;
  m.step(0x06df, 10);
  mem.write8(regs.hl, 0x34);
  m.step(0x06e1, 10);

  // 06E1-06EA: clamp the level number to 0x63 (99 decimal).
  regs.a = mem.read8(0x6229);
  m.step(0x06e4, 13);
  regs.cp(0x64);
  m.step(0x06e6, 7);
  if (regs.fC) {
    m.step(0x06ed, 12); // jr c taken -> loc_06ed
  } else {
    m.step(0x06e8, 7);
    regs.a = 0x63;
    m.step(0x06ea, 7);
    mem.write8(0x6229, regs.a);
    m.step(0x06ed, 13);
  }

  // 06ED-06F5: split into tens (B) and units (A) by repeated subtraction.
  regs.bc = 0xff0a; // B = 0xFF, C = 10
  m.step(0x06f0, 10);
  do {
    regs.b = regs.inc8(regs.b); // loc_06f0 -- runs BEFORE the first subtract
    m.step(0x06f1, 4);
    regs.sub(regs.c);
    m.step(0x06f2, 4);
    const again = regs.fNC;
    m.step(again ? 0x06f0 : 0x06f5, 10); // jp nc
    if (!again) break;
  } while (true);
  regs.add(regs.c); // undo the borrowing subtraction
  m.step(0x06f6, 4);

  mem.write8(0x74a3, regs.a); // units digit
  m.step(0x06f9, 13);
  regs.a = regs.b;
  m.step(0x06fa, 4);
  mem.write8(0x74c3, regs.a); // tens digit
  m.step(0x06fd, 13);

  m.ret(); // 06fd: ret
  return true;
}
