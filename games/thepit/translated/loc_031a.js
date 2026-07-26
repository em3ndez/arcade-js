// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_031a  (ROM 0x031a-0x0345, The Pit) -- round/play (re)init that runs the
 * pre-play setup call chain, derives the per-frame idle-delay counter, clears two
 * flags, then FALLS THROUGH into the main game loop at loc_0348.
 *
 * Reached only by `jp 0x031a` (from loc_02e1's tail at 0x02fa and from 0x03e5), so
 * it is entered like a routine but never has its own caller to `ret` to -- it ends
 * by falling into loc_0348, which resets SP and loops forever.
 *
 *   031a  cd 67 4c     call 0x4c67
 *   031d  cd 44 46     call 0x4644
 *   0320  cd 73 06     call 0x0673        ; paint the screen (tilemap+colour)
 *   0323  3a 01 80     ld   a,(0x8001)
 *   0326  3d           dec  a
 *   0327  fe 02        cp   0x02
 *   0329  dc e1 47     call c,0x47e1      ; only when (0x8001)-1 < 2 (carry)
 *   032c  cd 62 13     call 0x1362
 *   032f  cd e8 23     call 0x23e8
 *   0332  cd cf 24     call 0x24cf
 *   0335  3a 28 80     ld   a,(0x8028)
 *   0338  47           ld   b,a
 *   0339  3a 4e 80     ld   a,(0x804e)
 *   033c  90           sub  b            ; A = (0x804e) - (0x8028)
 *   033d  32 11 80     ld   (0x8011),a   ; store the per-frame delay count
 *   0340  3e 00        ld   a,0x00
 *   0342  32 20 80     ld   (0x8020),a   ; clear
 *   0345  32 10 80     ld   (0x8010),a   ; clear
 *   ---- falls through into loc_0348 (the main game loop) ----
 *
 * The `call c,0x47e1` at 0x0329 is a CONDITIONAL call: the carry it tests is set by
 * `cp 0x02` on A = (0x8001)-1, i.e. it fires only when (0x8001)-1 is 0 or 1
 * (unsigned) -- taken 17 T (pushes 0x032c), not taken 10 T (no push), per the Z80.
 *
 * The delay byte at 0x8011 is (0x804e) - (0x8028) with full `sub` flag semantics;
 * loc_0348 later busy-waits that many units before looping. The `ld b,a` /
 * `ld a,(nn)` / `sub b` order means B is the subtrahend (0x8028) and A the minuend
 * (0x804e), so the stored value is minuend - subtrahend, not the reverse.
 *
 * TAIL/FALL-THROUGH: there is NO ret and NO jp here -- the last instruction
 * (0x0345, ld (0x8010),a) simply advances PC to 0x0348 and execution continues into
 * loc_0348. That transfer pushes nothing, so it is modelled as `return
 * m.call(0x0348)` WITHOUT an extra m.step (unlike loc_02e1's real `jp`, which
 * charges 10 T): the fall-through costs no cycles of its own. loc_0348 never
 * returns (it resets SP and loops), so this call never comes back -- faithful.
 *
 * Work-RAM stores (0x8011/0x8020/0x8010) take no bus-cycle offset.
 */
export function loc_031a(m) {
  const { regs, mem } = m;

  m.push16(0x031d);
  m.step(0x4c67, 17); // 031a  call 0x4c67
  m.call(0x4c67);

  m.push16(0x0320);
  m.step(0x4644, 17); // 031d  call 0x4644
  m.call(0x4644);

  m.push16(0x0323);
  m.step(0x0673, 17); // 0320  call 0x0673
  m.call(0x0673);

  regs.a = mem.read8(0x8001);
  m.step(0x0326, 13); // 0323  ld a,(0x8001)
  regs.a = regs.dec8(regs.a);
  m.step(0x0327, 4); // 0326  dec a
  regs.cp(0x02);
  m.step(0x0329, 7); // 0327  cp 0x02
  if (regs.fC) {
    m.push16(0x032c);
    m.step(0x47e1, 17); // 0329  call c,0x47e1 (taken)
    m.call(0x47e1);
  } else {
    m.step(0x032c, 10); // 0329  call c,0x47e1 (not taken)
  }

  m.push16(0x032f);
  m.step(0x1362, 17); // 032c  call 0x1362
  m.call(0x1362);

  m.push16(0x0332);
  m.step(0x23e8, 17); // 032f  call 0x23e8
  m.call(0x23e8);

  m.push16(0x0335);
  m.step(0x24cf, 17); // 0332  call 0x24cf
  m.call(0x24cf);

  regs.a = mem.read8(0x8028);
  m.step(0x0338, 13); // 0335  ld a,(0x8028)
  regs.b = regs.a;
  m.step(0x0339, 4); // 0338  ld b,a
  regs.a = mem.read8(0x804e);
  m.step(0x033c, 13); // 0339  ld a,(0x804e)
  regs.sub(regs.b);
  m.step(0x033d, 4); // 033c  sub b -- A = (0x804e) - (0x8028)
  mem.write8(0x8011, regs.a);
  m.step(0x0340, 13); // 033d  ld (0x8011),a
  regs.a = 0x00;
  m.step(0x0342, 7); // 0340  ld a,0x00
  mem.write8(0x8020, regs.a);
  m.step(0x0345, 13); // 0342  ld (0x8020),a
  mem.write8(0x8010, regs.a);
  m.step(0x0348, 13); // 0345  ld (0x8010),a -- PC advances to 0x0348 (fall-through)

  // Fall-through into loc_0348 (the main game loop). No CALL is executed, so
  // nothing is pushed and no extra T-states are charged; loc_0348's control flow
  // (it resets SP and loops forever) subsumes ours.
  return m.call(0x0348);
}
