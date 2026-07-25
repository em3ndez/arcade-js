// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_3d49  (ROM 0x3d49-0x3d7d) — lays out one fixed text/HUD panel, then
 * TAIL-jumps into 0x3e01 to paint its colour cells.
 *
 * Writes the layout scratch cells the 0x3dxx draw helpers read — column
 * 0x8058 = 0x01, row 0x8059 = 0x0c, attribute 0x8057 = 0x06, run-length
 * 0x8055 (reloaded per field: 0x01, 0x08, 0x09) — bracketing them with the two
 * address-setup calls (0x3dae computes the tilemap offset into 0x805a; 0x3dc9
 * derives the colour targets 0x805e/0x8060). It then renders a work-RAM field
 * (ix = 0x8000) via 0x3dea and a ROM string (ix = 0x496d) via 0x3ddb, and ends
 * with `jp 0x3e01` — a tail-jump, so 0x3e01's own `ret` returns to OUR caller.
 *
 *   3d49  3e 01        ld   a,0x01
 *   3d4b  32 58 80     ld   (0x8058),a
 *   3d4e  3e 0c        ld   a,0x0c
 *   3d50  32 59 80     ld   (0x8059),a
 *   3d53  cd ae 3d     call 0x3dae
 *   3d56  cd c9 3d     call 0x3dc9
 *   3d59  3e 06        ld   a,0x06
 *   3d5b  32 57 80     ld   (0x8057),a
 *   3d5e  3e 01        ld   a,0x01
 *   3d60  32 55 80     ld   (0x8055),a
 *   3d63  dd 21 00 80  ld   ix,0x8000
 *   3d67  cd ea 3d     call 0x3dea
 *   3d6a  3e 08        ld   a,0x08
 *   3d6c  32 55 80     ld   (0x8055),a
 *   3d6f  dd 21 6d 49  ld   ix,0x496d
 *   3d73  cd db 3d     call 0x3ddb
 *   3d76  3e 09        ld   a,0x09
 *   3d78  32 55 80     ld   (0x8055),a
 *   3d7b  c3 01 3e     jp   0x3e01
 *
 * The `jp 0x3e01` pushes nothing, so it is `m.step(target,10); return
 * m.call(target)` — NOT the `m.call; m.ret()` shape, which would ret a SECOND
 * time (0x3e01 already rets to our caller) and charge a phantom 10 T. Same
 * tail-jump convention as sub_3b81 in this game. No instruction here touches
 * F, so flags pass through from entry unchanged.
 */
export function sub_3d49(m) {
  const { regs, mem } = m;

  regs.a = 0x01;
  m.step(0x3d4b, 7); // 3d49  ld a,0x01

  mem.write8(0x8058, regs.a);
  m.step(0x3d4e, 13); // 3d4b  ld (0x8058),a

  regs.a = 0x0c;
  m.step(0x3d50, 7); // 3d4e  ld a,0x0c

  mem.write8(0x8059, regs.a);
  m.step(0x3d53, 13); // 3d50  ld (0x8059),a

  m.push16(0x3d56);
  m.step(0x3dae, 17); // 3d53  call 0x3dae
  m.call(0x3dae);

  m.push16(0x3d59);
  m.step(0x3dc9, 17); // 3d56  call 0x3dc9
  m.call(0x3dc9);

  regs.a = 0x06;
  m.step(0x3d5b, 7); // 3d59  ld a,0x06

  mem.write8(0x8057, regs.a);
  m.step(0x3d5e, 13); // 3d5b  ld (0x8057),a

  regs.a = 0x01;
  m.step(0x3d60, 7); // 3d5e  ld a,0x01

  mem.write8(0x8055, regs.a);
  m.step(0x3d63, 13); // 3d60  ld (0x8055),a

  regs.ix = 0x8000;
  m.step(0x3d67, 14); // 3d63  ld ix,0x8000

  m.push16(0x3d6a);
  m.step(0x3dea, 17); // 3d67  call 0x3dea
  m.call(0x3dea);

  regs.a = 0x08;
  m.step(0x3d6c, 7); // 3d6a  ld a,0x08

  mem.write8(0x8055, regs.a);
  m.step(0x3d6f, 13); // 3d6c  ld (0x8055),a

  regs.ix = 0x496d;
  m.step(0x3d73, 14); // 3d6f  ld ix,0x496d

  m.push16(0x3d76);
  m.step(0x3ddb, 17); // 3d73  call 0x3ddb
  m.call(0x3ddb);

  regs.a = 0x09;
  m.step(0x3d78, 7); // 3d76  ld a,0x09

  mem.write8(0x8055, regs.a);
  m.step(0x3d7b, 13); // 3d78  ld (0x8055),a

  // 3d7b  jp 0x3e01 -- tail-jump (pushes nothing; 0x3e01's ret returns to OUR caller)
  m.step(0x3e01, 10);
  return m.call(0x3e01);
}
