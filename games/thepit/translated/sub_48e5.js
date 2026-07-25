// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_48e5  (ROM 0x48E5–0x4908, The Pit) — draws one text/attribute column: seats
 * the column coordinate (0x8058=1, 0x8059=0x0C), derives its tilemap/colour
 * addresses (call 0x3dae -> 0x3dc9), then loads the fill byte 0x06 (0x8057) and
 * row count 0x09 (0x8055) and a source pointer IX=0x49A5, copies that 9-byte run
 * down the column (call 0x3dea), and tail-jumps to the column fill at 0x3e01
 * (which lays 9 cells of 0x06 and runs its own `ret`). Straight-line, no
 * conditionals; touches no flags. (Role is best-effort from the code; addresses,
 * cycles and control flow are exact.)
 *
 *   48e5  3e 01        ld   a,0x01
 *   48e7  32 58 80     ld   (0x8058),a
 *   48ea  3e 0c        ld   a,0x0c
 *   48ec  32 59 80     ld   (0x8059),a
 *   48ef  cd ae 3d     call 0x3dae
 *   48f2  cd c9 3d     call 0x3dc9
 *   48f5  3e 06        ld   a,0x06
 *   48f7  32 57 80     ld   (0x8057),a
 *   48fa  3e 09        ld   a,0x09
 *   48fc  32 55 80     ld   (0x8055),a
 *   48ff  dd 21 a5 49  ld   ix,0x49a5
 *   4903  cd ea 3d     call 0x3dea
 *   4906  c3 01 3e     jp   0x3e01
 *
 * Control-flow note: the closing `jp 0x3e01` is a tail-jump into another routine,
 * not a loop back-edge. Nothing is pushed, so it is modelled
 * `m.step(0x3e01,10); return m.call(0x3e01)` -- sub_3e01 ends in its OWN `ret`,
 * which pops OUR caller's return address. Adding a second `m.ret()` here would
 * double-pop the stack (same convention as the sibling sub_241c tail-jumps).
 */
export function sub_48e5(m) {
  const { regs, mem } = m;

  // 48e5  ld a,0x01
  regs.a = 0x01;
  m.step(0x48e7, 7);
  // 48e7  ld (0x8058),a -- column coordinate
  mem.write8(0x8058, regs.a);
  m.step(0x48ea, 13);
  // 48ea  ld a,0x0c
  regs.a = 0x0c;
  m.step(0x48ec, 7);
  // 48ec  ld (0x8059),a -- row coordinate
  mem.write8(0x8059, regs.a);
  m.step(0x48ef, 13);
  // 48ef  call 0x3dae -- row -> offset word (0x805a)
  m.push16(0x48f2); m.step(0x3dae, 17); m.call(0x3dae);
  // 48f2  call 0x3dc9 -- offset -> colour/video addresses (0x805e ...)
  m.push16(0x48f5); m.step(0x3dc9, 17); m.call(0x3dc9);
  // 48f5  ld a,0x06
  regs.a = 0x06;
  m.step(0x48f7, 7);
  // 48f7  ld (0x8057),a -- fill byte for the 0x3e01 tail
  mem.write8(0x8057, regs.a);
  m.step(0x48fa, 13);
  // 48fa  ld a,0x09
  regs.a = 0x09;
  m.step(0x48fc, 7);
  // 48fc  ld (0x8055),a -- row count for 0x3dea and 0x3e01
  mem.write8(0x8055, regs.a);
  m.step(0x48ff, 13);
  // 48ff  ld ix,0x49a5 -- source pointer for the copy (DD prefix: 14 T, not 10)
  regs.ix = 0x49a5;
  m.step(0x4903, 14);
  // 4903  call 0x3dea -- copy the 9-byte run down the column
  m.push16(0x4906); m.step(0x3dea, 17); m.call(0x3dea);
  // 4906  jp 0x3e01 -- tail-jump into the column fill (runs its own `ret`)
  m.step(0x3e01, 10);
  return m.call(0x3e01);
}
