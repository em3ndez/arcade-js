// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_47e1  (ROM 0x47E1-0x4815, The Pit) — composes one HUD/status panel by
 * seeding the shared tile-plotter parameters at 0x8055-0x8059 and driving the
 * plot helpers. Sets column 0x8058=1 and row 0x8059=0x0c, then sub_3dae turns
 * the row into a tilemap offset (0x805a) and sub_3dc9 derives the colour-RAM
 * (0x805e) and video-RAM (0x8060) cursors. It then lays three vertical runs down
 * that column: fill byte 0x8057=7; count 0x8055=1 with source ix=0x8002 copied
 * one cell down via sub_3dea; count 0x8055=7 with table ix=0x49b1 filled via
 * sub_3ddb; finally count 0x8055=9 and a TAIL-jump into sub_3e01, which paints a
 * 9-cell colour column with the 0x8057 byte and returns to OUR caller.
 *
 *   47e1  3e 01        ld   a,0x01
 *   47e3  32 58 80     ld   (0x8058),a
 *   47e6  3e 0c        ld   a,0x0c
 *   47e8  32 59 80     ld   (0x8059),a
 *   47eb  cd ae 3d     call 0x3dae          ; row 0x8059 -> tilemap offset 0x805a
 *   47ee  cd c9 3d     call 0x3dc9          ; offset -> colour/video cursors
 *   47f1  3e 07        ld   a,0x07
 *   47f3  32 57 80     ld   (0x8057),a      ; fill byte
 *   47f6  3e 01        ld   a,0x01
 *   47f8  32 55 80     ld   (0x8055),a      ; run length = 1
 *   47fb  dd 21 02 80  ld   ix,0x8002       ; copy source
 *   47ff  cd ea 3d     call 0x3dea          ; copy 1 cell down the column
 *   4802  3e 07        ld   a,0x07
 *   4804  32 55 80     ld   (0x8055),a      ; run length = 7
 *   4807  dd 21 b1 49  ld   ix,0x49b1       ; ROM table source
 *   480b  cd db 3d     call 0x3ddb          ; fill 7 cells (first fixed, then ix)
 *   480e  3e 09        ld   a,0x09
 *   4810  32 55 80     ld   (0x8055),a      ; run length = 9
 *   4813  c3 01 3e     jp   0x3e01          ; TAIL into sub_3e01 (paint colour col)
 *
 * One exit: the closing `jp 0x3e01` is an unconditional tail-jump. It pushes
 * nothing, so sub_3e01's own `ret` returns to whoever called sub_47e1 — hence
 * `m.step(0x3e01,10); return m.call(0x3e01)`, NOT m.call()+m.ret() (which would
 * pop a second word off the stack). The four inner `call`s are ordinary calls
 * (return to the instruction after them). Registers on exit are whatever the
 * plot helpers leave; A held 0x09 at the tail. ix = 0x49b1 at the tail.
 */
export function sub_47e1(m) {
  const { regs, mem } = m;

  regs.a = 0x01;
  m.step(0x47e3, 7); // 47e1  ld a,0x01

  mem.write8(0x8058, regs.a);
  m.step(0x47e6, 13); // 47e3  ld (0x8058),a -- column group

  regs.a = 0x0c;
  m.step(0x47e8, 7); // 47e6  ld a,0x0c

  mem.write8(0x8059, regs.a);
  m.step(0x47eb, 13); // 47e8  ld (0x8059),a -- row

  // 47eb  call 0x3dae -- row 0x8059 -> 16-bit tilemap offset at 0x805a.
  m.push16(0x47ee);
  m.step(0x3dae, 17);
  m.call(0x3dae);

  // 47ee  call 0x3dc9 -- offset 0x805a -> colour-RAM (0x805e) + video-RAM (0x8060).
  m.push16(0x47f1);
  m.step(0x3dc9, 17);
  m.call(0x3dc9);

  regs.a = 0x07;
  m.step(0x47f3, 7); // 47f1  ld a,0x07

  mem.write8(0x8057, regs.a);
  m.step(0x47f6, 13); // 47f3  ld (0x8057),a -- fill byte

  regs.a = 0x01;
  m.step(0x47f8, 7); // 47f6  ld a,0x01

  mem.write8(0x8055, regs.a);
  m.step(0x47fb, 13); // 47f8  ld (0x8055),a -- run length = 1

  regs.ix = 0x8002;
  m.step(0x47ff, 14); // 47fb  ld ix,0x8002 -- copy source

  // 47ff  call 0x3dea -- copy 1 byte down the column from ix=0x8002.
  m.push16(0x4802);
  m.step(0x3dea, 17);
  m.call(0x3dea);

  regs.a = 0x07;
  m.step(0x4804, 7); // 4802  ld a,0x07

  mem.write8(0x8055, regs.a);
  m.step(0x4807, 13); // 4804  ld (0x8055),a -- run length = 7

  regs.ix = 0x49b1;
  m.step(0x480b, 14); // 4807  ld ix,0x49b1 -- ROM table source

  // 480b  call 0x3ddb -- fill 7 cells (first fixed byte, then ix walked back).
  m.push16(0x480e);
  m.step(0x3ddb, 17);
  m.call(0x3ddb);

  regs.a = 0x09;
  m.step(0x4810, 7); // 480e  ld a,0x09

  mem.write8(0x8055, regs.a);
  m.step(0x4813, 13); // 4810  ld (0x8055),a -- run length = 9

  // 4813  jp 0x3e01 -- TAIL into sub_3e01; it pushes nothing, so sub_3e01's own
  // ret returns to OUR caller. Return its result straight through (single pop).
  m.step(0x3e01, 10);
  return m.call(0x3e01);
}
