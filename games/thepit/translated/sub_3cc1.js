// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_3cc1  (ROM 0x3cc1-0x3d48) — lays out a fixed panel by driving the shared
 * draw helpers (0x3dae/0x3dc9/0x3dea/0x3ddb/0x3e01/0x3e1d) through a scripted
 * sequence of position/attribute bytes. It stages each element by writing the
 * "cursor" work-RAM cells — 0x8058/0x8059 (row/col), 0x8057 (a tile/char code),
 * 0x8055 (a length/index) — and IX (a source pointer) before each helper call.
 * Ends by TAIL-jumping into 0x47a1 (after 0x4785), whose own `ret` returns to
 * OUR caller.
 *
 *   3cc1  cd f4 46     call 0x46f4
 *   3cc4  cd 2c 47     call 0x472c
 *   3cc7  3e 07        ld   a,0x07
 *   3cc9  32 58 80     ld   (0x8058),a
 *   3ccc  3e 09        ld   a,0x09
 *   3cce  32 59 80     ld   (0x8059),a
 *   3cd1  cd ae 3d     call 0x3dae
 *   3cd4  cd c9 3d     call 0x3dc9
 *   3cd7  3e a5        ld   a,0xa5
 *   3cd9  32 57 80     ld   (0x8057),a
 *   3cdc  3e 0f        ld   a,0x0f
 *   3cde  32 55 80     ld   (0x8055),a
 *   3ce1  dd 21 7b 49  ld   ix,0x497b
 *   3ce5  cd ea 3d     call 0x3dea
 *   3ce8  cd 01 3e     call 0x3e01
 *   3ceb  3e 09        ld   a,0x09
 *   3ced  32 58 80     ld   (0x8058),a
 *   3cf0  3e 0d        ld   a,0x0d
 *   3cf2  32 59 80     ld   (0x8059),a
 *   3cf5  cd ae 3d     call 0x3dae
 *   3cf8  cd c9 3d     call 0x3dc9
 *   3cfb  3e a5        ld   a,0xa5
 *   3cfd  32 57 80     ld   (0x8057),a
 *   3d00  3e 01        ld   a,0x01
 *   3d02  32 55 80     ld   (0x8055),a
 *   3d05  dd 21 02 80  ld   ix,0x8002
 *   3d09  cd ea 3d     call 0x3dea
 *   3d0c  3e 07        ld   a,0x07
 *   3d0e  32 55 80     ld   (0x8055),a
 *   3d11  dd 21 b1 49  ld   ix,0x49b1
 *   3d15  cd db 3d     call 0x3ddb
 *   3d18  3e 08        ld   a,0x08
 *   3d1a  32 55 80     ld   (0x8055),a
 *   3d1d  cd 01 3e     call 0x3e01
 *   3d20  3e 0d        ld   a,0x0d
 *   3d22  32 58 80     ld   (0x8058),a
 *   3d25  3e 09        ld   a,0x09
 *   3d27  32 59 80     ld   (0x8059),a
 *   3d2a  cd ae 3d     call 0x3dae
 *   3d2d  cd c9 3d     call 0x3dc9
 *   3d30  3e 0f        ld   a,0x0f
 *   3d32  32 55 80     ld   (0x8055),a
 *   3d35  dd 21 f7 49  ld   ix,0x49f7
 *   3d39  cd ea 3d     call 0x3dea
 *   3d3c  3e 0d        ld   a,0x0d
 *   3d3e  0e a3        ld   c,0xa3
 *   3d40  cd 1d 3e     call 0x3e1d
 *   3d43  cd 85 47     call 0x4785
 *   3d46  c3 a1 47     jp   0x47a1
 *
 * Straight-line: no branches, no flag consumers of its own. The 0x8055/0x8057/
 * 0x8058/0x8059 cells are the parameter block the helpers read, so the ORDER of
 * the writes relative to the calls is load-bearing — each element is drawn with
 * whatever those cells hold at that call. `ld ix,nnnn` is DD-prefixed = 14 T
 * (the plain `ld rr,nn` is 10; the +4 is the prefix fetch). The final `jp 0x47a1`
 * is a tail-jump (pushes nothing; 0x47a1's `ret` returns to OUR caller), so it is
 * `m.step(target,10); return m.call(target)`, NOT the `m.call; m.ret()` shape —
 * that would push a spurious word and charge a second ret (see sub_3b81).
 */
export function sub_3cc1(m) {
  const { regs, mem } = m;

  m.push16(0x3cc4);
  m.step(0x46f4, 17); // 3cc1  call 0x46f4
  m.call(0x46f4);

  m.push16(0x3cc7);
  m.step(0x472c, 17); // 3cc4  call 0x472c
  m.call(0x472c);

  regs.a = 0x07;
  m.step(0x3cc9, 7); // 3cc7  ld a,0x07
  mem.write8(0x8058, regs.a);
  m.step(0x3ccc, 13); // 3cc9  ld (0x8058),a

  regs.a = 0x09;
  m.step(0x3cce, 7); // 3ccc  ld a,0x09
  mem.write8(0x8059, regs.a);
  m.step(0x3cd1, 13); // 3cce  ld (0x8059),a

  m.push16(0x3cd4);
  m.step(0x3dae, 17); // 3cd1  call 0x3dae
  m.call(0x3dae);

  m.push16(0x3cd7);
  m.step(0x3dc9, 17); // 3cd4  call 0x3dc9
  m.call(0x3dc9);

  regs.a = 0xa5;
  m.step(0x3cd9, 7); // 3cd7  ld a,0xa5
  mem.write8(0x8057, regs.a);
  m.step(0x3cdc, 13); // 3cd9  ld (0x8057),a

  regs.a = 0x0f;
  m.step(0x3cde, 7); // 3cdc  ld a,0x0f
  mem.write8(0x8055, regs.a);
  m.step(0x3ce1, 13); // 3cde  ld (0x8055),a

  regs.ix = 0x497b;
  m.step(0x3ce5, 14); // 3ce1  ld ix,0x497b (DD-prefixed = 14 T)

  m.push16(0x3ce8);
  m.step(0x3dea, 17); // 3ce5  call 0x3dea
  m.call(0x3dea);

  m.push16(0x3ceb);
  m.step(0x3e01, 17); // 3ce8  call 0x3e01
  m.call(0x3e01);

  regs.a = 0x09;
  m.step(0x3ced, 7); // 3ceb  ld a,0x09
  mem.write8(0x8058, regs.a);
  m.step(0x3cf0, 13); // 3ced  ld (0x8058),a

  regs.a = 0x0d;
  m.step(0x3cf2, 7); // 3cf0  ld a,0x0d
  mem.write8(0x8059, regs.a);
  m.step(0x3cf5, 13); // 3cf2  ld (0x8059),a

  m.push16(0x3cf8);
  m.step(0x3dae, 17); // 3cf5  call 0x3dae
  m.call(0x3dae);

  m.push16(0x3cfb);
  m.step(0x3dc9, 17); // 3cf8  call 0x3dc9
  m.call(0x3dc9);

  regs.a = 0xa5;
  m.step(0x3cfd, 7); // 3cfb  ld a,0xa5
  mem.write8(0x8057, regs.a);
  m.step(0x3d00, 13); // 3cfd  ld (0x8057),a

  regs.a = 0x01;
  m.step(0x3d02, 7); // 3d00  ld a,0x01
  mem.write8(0x8055, regs.a);
  m.step(0x3d05, 13); // 3d02  ld (0x8055),a

  regs.ix = 0x8002;
  m.step(0x3d09, 14); // 3d05  ld ix,0x8002 (DD-prefixed = 14 T)

  m.push16(0x3d0c);
  m.step(0x3dea, 17); // 3d09  call 0x3dea
  m.call(0x3dea);

  regs.a = 0x07;
  m.step(0x3d0e, 7); // 3d0c  ld a,0x07
  mem.write8(0x8055, regs.a);
  m.step(0x3d11, 13); // 3d0e  ld (0x8055),a

  regs.ix = 0x49b1;
  m.step(0x3d15, 14); // 3d11  ld ix,0x49b1 (DD-prefixed = 14 T)

  m.push16(0x3d18);
  m.step(0x3ddb, 17); // 3d15  call 0x3ddb
  m.call(0x3ddb);

  regs.a = 0x08;
  m.step(0x3d1a, 7); // 3d18  ld a,0x08
  mem.write8(0x8055, regs.a);
  m.step(0x3d1d, 13); // 3d1a  ld (0x8055),a

  m.push16(0x3d20);
  m.step(0x3e01, 17); // 3d1d  call 0x3e01
  m.call(0x3e01);

  regs.a = 0x0d;
  m.step(0x3d22, 7); // 3d20  ld a,0x0d
  mem.write8(0x8058, regs.a);
  m.step(0x3d25, 13); // 3d22  ld (0x8058),a

  regs.a = 0x09;
  m.step(0x3d27, 7); // 3d25  ld a,0x09
  mem.write8(0x8059, regs.a);
  m.step(0x3d2a, 13); // 3d27  ld (0x8059),a

  m.push16(0x3d2d);
  m.step(0x3dae, 17); // 3d2a  call 0x3dae
  m.call(0x3dae);

  m.push16(0x3d30);
  m.step(0x3dc9, 17); // 3d2d  call 0x3dc9
  m.call(0x3dc9);

  regs.a = 0x0f;
  m.step(0x3d32, 7); // 3d30  ld a,0x0f
  mem.write8(0x8055, regs.a);
  m.step(0x3d35, 13); // 3d32  ld (0x8055),a

  regs.ix = 0x49f7;
  m.step(0x3d39, 14); // 3d35  ld ix,0x49f7 (DD-prefixed = 14 T)

  m.push16(0x3d3c);
  m.step(0x3dea, 17); // 3d39  call 0x3dea
  m.call(0x3dea);

  regs.a = 0x0d;
  m.step(0x3d3e, 7); // 3d3c  ld a,0x0d
  regs.c = 0xa3;
  m.step(0x3d40, 7); // 3d3e  ld c,0xa3

  m.push16(0x3d43);
  m.step(0x3e1d, 17); // 3d40  call 0x3e1d
  m.call(0x3e1d);

  m.push16(0x3d46);
  m.step(0x4785, 17); // 3d43  call 0x4785
  m.call(0x4785);

  // 3d46  jp 0x47a1 -- tail-jump (pushes nothing; 0x47a1's ret returns to OUR caller)
  m.step(0x47a1, 10);
  return m.call(0x47a1);
}
