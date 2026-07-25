// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_3d8a  (ROM 0x3d8a-0x3dad) — draws a 9-cell vertical strip: seeds the
 * col/row/count state bytes, derives the colour- and video-RAM column addresses
 * (via sub_3dae + sub_3dc9), copies a 9-byte tile run out of a descending ROM
 * table at 0x49a5 into the video column (sub_3dea), then TAIL-jumps into sub_3e01
 * to paint the matching colour column solid 0x06.
 *
 *   3d8a  3e 06        ld   a,0x06
 *   3d8c  32 58 80     ld   (0x8058),a    ; column byte = 6
 *   3d8f  3e 0c        ld   a,0x0c
 *   3d91  32 59 80     ld   (0x8059),a    ; row byte = 12
 *   3d94  cd ae 3d     call 0x3dae        ; 0x805a = 32*row + col = 0x186
 *   3d97  cd c9 3d     call 0x3dc9        ; 0x805e = 0x186+0x8800 (colour cell)
 *                                         ; 0x8060 = 0x186+0x9000 (video cell)
 *   3d9a  3e 06        ld   a,0x06
 *   3d9c  32 57 80     ld   (0x8057),a    ; fill/tile byte = 6
 *   3d9f  3e 09        ld   a,0x09
 *   3da1  32 55 80     ld   (0x8055),a    ; row count = 9
 *   3da4  dd 21 a5 49  ld   ix,0x49a5     ; descending source pointer
 *   3da8  cd ea 3d     call 0x3dea        ; copy 9 tiles down the video column
 *   3dab  c3 01 3e     jp   0x3e01        ; tail-jump: paint the colour column
 *
 * The tail `jp 0x3e01` pushes nothing, so sub_3e01's own `ret` returns to OUR
 * caller. It is modelled `m.step(0x3e01,10); return m.call(0x3e01)` — NOT the
 * `m.call(); m.ret()` shape, which would pop a spurious word off the stack and
 * charge a second ret (same trap the sub_3d7e / sub_3b81 headers call out; both
 * of those also tail into 0x3e01). None of this routine's own instructions touch
 * a flag — it is straight-line stores, calls and a jump.
 */
export function sub_3d8a(m) {
  const { regs, mem } = m;

  regs.a = 0x06;
  m.step(0x3d8c, 7); // 3d8a  ld a,0x06

  mem.write8(0x8058, regs.a);
  m.step(0x3d8f, 13); // 3d8c  ld (0x8058),a -- column byte

  regs.a = 0x0c;
  m.step(0x3d91, 7); // 3d8f  ld a,0x0c

  mem.write8(0x8059, regs.a);
  m.step(0x3d94, 13); // 3d91  ld (0x8059),a -- row byte

  m.push16(0x3d97);
  m.step(0x3dae, 17); // 3d94  call 0x3dae -- row/col -> tilemap offset @0x805a
  m.call(0x3dae);

  m.push16(0x3d9a);
  m.step(0x3dc9, 17); // 3d97  call 0x3dc9 -- offset -> colour@0x805e, video@0x8060
  m.call(0x3dc9);

  regs.a = 0x06;
  m.step(0x3d9c, 7); // 3d9a  ld a,0x06

  mem.write8(0x8057, regs.a);
  m.step(0x3d9f, 13); // 3d9c  ld (0x8057),a -- fill/tile byte

  regs.a = 0x09;
  m.step(0x3da1, 7); // 3d9f  ld a,0x09

  mem.write8(0x8055, regs.a);
  m.step(0x3da4, 13); // 3da1  ld (0x8055),a -- row count

  regs.ix = 0x49a5;
  m.step(0x3da8, 14); // 3da4  ld ix,0x49a5 -- descending source pointer

  m.push16(0x3dab);
  m.step(0x3dea, 17); // 3da8  call 0x3dea -- copy 9 tiles down the video column
  m.call(0x3dea);

  // 3dab  jp 0x3e01 -- tail-jump; sub_3e01's ret returns to OUR caller.
  m.step(0x3e01, 10);
  return m.call(0x3e01);
}
