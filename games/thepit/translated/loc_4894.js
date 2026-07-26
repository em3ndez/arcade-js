// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_4894  (ROM 0x4894–0x48C3, The Pit) — draws one labelled tilemap column:
 * seats the column/row coordinate (0x8058=6, 0x8059=0x0A), derives that cell's
 * tilemap/colour addresses (call 0x3dae -> 0x3dc9), stows the colour fill byte
 * 0x96 (0x8057), then lays two runs into the tilemap starting at (0x8060):
 * a ONE-cell run copied from IX=0x8000 (0x8055=1, call 0x3dea) followed by an
 * EIGHT-cell strip whose first cell is the fixed cap byte (0x4b0f) and whose
 * remaining cells walk backwards through the text at IX=0x496d (0x8055=8, call
 * 0x3ddb). Finally it tail-jumps to the column fill at 0x3e01, which lays eight
 * matching colour cells of 0x96 at (0x805e) and runs its own `ret`.
 *
 * Straight-line, no conditionals; touches no flags of its own (callees set some,
 * none read here). NOTE 0x8055 is written TWICE — 0x01 for the 0x3dea copy then
 * 0x08 for the 0x3ddb strip and the 0x3e01 tail — so its FINAL value is 0x08, and
 * IX is loaded twice so its FINAL value is 0x496d. (Role is best-effort from the
 * code; addresses, cycles and control flow are exact.)
 *
 *   4894  3e 06        ld   a,0x06
 *   4896  32 58 80     ld   (0x8058),a
 *   4899  3e 0a        ld   a,0x0a
 *   489b  32 59 80     ld   (0x8059),a
 *   489e  cd ae 3d     call 0x3dae
 *   48a1  cd c9 3d     call 0x3dc9
 *   48a4  3e 96        ld   a,0x96
 *   48a6  32 57 80     ld   (0x8057),a
 *   48a9  3e 01        ld   a,0x01
 *   48ab  32 55 80     ld   (0x8055),a
 *   48ae  dd 21 00 80  ld   ix,0x8000
 *   48b2  cd ea 3d     call 0x3dea
 *   48b5  3e 08        ld   a,0x08
 *   48b7  32 55 80     ld   (0x8055),a
 *   48ba  dd 21 6d 49  ld   ix,0x496d
 *   48be  cd db 3d     call 0x3ddb
 *   48c1  c3 01 3e     jp   0x3e01
 *
 * Control-flow note: the closing `jp 0x3e01` is a tail-jump into another routine,
 * not a loop back-edge. Nothing is pushed, so it is modelled
 * `m.step(0x3e01,10); return m.call(0x3e01)` -- loc_3e01 ends in its OWN `ret`,
 * which pops OUR caller's return address. Adding a second `m.ret()` here would
 * double-pop the stack (same convention as the sibling loc_48e5 tail-jump).
 */
export function loc_4894(m) {
  const { regs, mem } = m;

  // 4894  ld a,0x06
  regs.a = 0x06;
  m.step(0x4896, 7);
  // 4896  ld (0x8058),a -- column coordinate
  mem.write8(0x8058, regs.a);
  m.step(0x4899, 13);
  // 4899  ld a,0x0a
  regs.a = 0x0a;
  m.step(0x489b, 7);
  // 489b  ld (0x8059),a -- row coordinate
  mem.write8(0x8059, regs.a);
  m.step(0x489e, 13);
  // 489e  call 0x3dae -- row -> tilemap offset word (0x805a)
  m.push16(0x48a1); m.step(0x3dae, 17); m.call(0x3dae);
  // 48a1  call 0x3dc9 -- offset -> colour (0x805e) + video (0x8060) addresses
  m.push16(0x48a4); m.step(0x3dc9, 17); m.call(0x3dc9);
  // 48a4  ld a,0x96
  regs.a = 0x96;
  m.step(0x48a6, 7);
  // 48a6  ld (0x8057),a -- colour fill byte for the 0x3e01 tail
  mem.write8(0x8057, regs.a);
  m.step(0x48a9, 13);
  // 48a9  ld a,0x01
  regs.a = 0x01;
  m.step(0x48ab, 7);
  // 48ab  ld (0x8055),a -- row count = 1 for the first (0x3dea) copy
  mem.write8(0x8055, regs.a);
  m.step(0x48ae, 13);
  // 48ae  ld ix,0x8000 -- source pointer for the 1-cell copy (DD prefix: 14 T)
  regs.ix = 0x8000;
  m.step(0x48b2, 14);
  // 48b2  call 0x3dea -- copy the 1-byte run into the top cell of the column
  m.push16(0x48b5); m.step(0x3dea, 17); m.call(0x3dea);
  // 48b5  ld a,0x08
  regs.a = 0x08;
  m.step(0x48b7, 7);
  // 48b7  ld (0x8055),a -- row count = 8 for the strip and the 0x3e01 tail
  mem.write8(0x8055, regs.a);
  m.step(0x48ba, 13);
  // 48ba  ld ix,0x496d -- text source for the 8-cell strip (DD prefix: 14 T)
  regs.ix = 0x496d;
  m.step(0x48be, 14);
  // 48be  call 0x3ddb -- fill the 8-cell strip (first = 0x4b0f cap, rest from IX)
  m.push16(0x48c1); m.step(0x3ddb, 17); m.call(0x3ddb);
  // 48c1  jp 0x3e01 -- tail-jump into the column colour fill (runs its own `ret`)
  m.step(0x3e01, 10);
  return m.call(0x3e01);
}
