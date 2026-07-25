// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_483a  (ROM 0x483A-0x4893, The Pit) — lays out one HUD/text panel, choosing
 * between two variants on the byte at 0x802B, then TAIL-jumps into 0x3e01 to
 * paint the panel's colour cells.
 *
 * Always writes column cell 0x8058 = 0x05 first, then reads 0x802B and
 * `dec a`: if that leaves zero (0x802B == 1) it takes the loc_4875 arm, else it
 * falls through. Both arms follow the same 0x3dxx draw idiom — set the layout
 * scratch cells (row 0x8059, attribute 0x8057, run-length 0x8055), bracket them
 * with the two address-setup calls (0x3dae -> tilemap offset into 0x805a; 0x3dc9
 * -> colour targets 0x805e/0x8060), render source strips via 0x3dea — and end
 * with `jp 0x3e01`, whose own `ret` returns to OUR caller.
 *   - fall-through (0x802B != 1): row 0x0b, attr 0x97, two 0x3dea renders
 *     (ix=0x49ba then ix=0x802b), run-lengths 0x09 / 0x01 / 0x0a.
 *   - loc_4875   (0x802B == 1):  row 0x0c, attr 0x96, one 0x3dea render (ix=0x49c2),
 *     run-length 0x08.
 * (Panel role best-effort from the code; addresses, T-states, flags and control
 * flow are exact.)
 *
 * loc_483a:
 *   483a  3e 05        ld   a,0x05
 *   483c  32 58 80     ld   (0x8058),a
 *   483f  3a 2b 80     ld   a,(0x802b)
 *   4842  3d           dec  a
 *   4843  28 30        jr   z,0x4875
 *   4845  3e 0b        ld   a,0x0b
 *   4847  32 59 80     ld   (0x8059),a
 *   484a  cd ae 3d     call 0x3dae
 *   484d  cd c9 3d     call 0x3dc9
 *   4850  3e 97        ld   a,0x97
 *   4852  32 57 80     ld   (0x8057),a
 *   4855  3e 09        ld   a,0x09
 *   4857  32 55 80     ld   (0x8055),a
 *   485a  dd 21 ba 49  ld   ix,0x49ba
 *   485e  cd ea 3d     call 0x3dea
 *   4861  3e 01        ld   a,0x01
 *   4863  32 55 80     ld   (0x8055),a
 *   4866  dd 21 2b 80  ld   ix,0x802b
 *   486a  cd ea 3d     call 0x3dea
 *   486d  3e 0a        ld   a,0x0a
 *   486f  32 55 80     ld   (0x8055),a
 *   4872  c3 01 3e     jp   0x3e01
 * loc_4875:
 *   4875  3e 0c        ld   a,0x0c
 *   4877  32 59 80     ld   (0x8059),a
 *   487a  cd ae 3d     call 0x3dae
 *   487d  cd c9 3d     call 0x3dc9
 *   4880  3e 96        ld   a,0x96
 *   4882  32 57 80     ld   (0x8057),a
 *   4885  3e 08        ld   a,0x08
 *   4887  32 55 80     ld   (0x8055),a
 *   488a  dd 21 c2 49  ld   ix,0x49c2
 *   488e  cd ea 3d     call 0x3dea
 *   4891  c3 01 3e     jp   0x3e01
 *
 * `dec a` is the only flag-affecting instruction; every other opcode (ld a,n,
 * ld (nn),a, call, ld ix,nn, jp) leaves F alone, so the flags at the tail-jump
 * are `dec a`'s (S/Z/H/PV/N set, carry passed through from entry). Each
 * `jp 0x3e01` pushes nothing, so it is `m.step(target,10); return m.call(target)`
 * — NOT `m.call; m.ret()`, which would ret a SECOND time (0x3e01 already rets to
 * our caller) and charge a phantom 10 T. Same tail-jump convention as loc_3d49.
 */
export function loc_483a(m) {
  const { regs, mem } = m;

  regs.a = 0x05;
  m.step(0x483c, 7); // 483a  ld a,0x05

  mem.write8(0x8058, regs.a);
  m.step(0x483f, 13); // 483c  ld (0x8058),a

  regs.a = mem.read8(0x802b);
  m.step(0x4842, 13); // 483f  ld a,(0x802b)

  regs.a = regs.dec8(regs.a);
  m.step(0x4843, 4); // 4842  dec a  -- sets S/Z/H/PV/N, keeps C

  if (regs.fZ) {
    // 4843  jr z,0x4875 taken (0x802b == 1) -> loc_4875
    m.step(0x4875, 12);

    regs.a = 0x0c;
    m.step(0x4877, 7); // 4875  ld a,0x0c

    mem.write8(0x8059, regs.a);
    m.step(0x487a, 13); // 4877  ld (0x8059),a

    m.push16(0x487d);
    m.step(0x3dae, 17); // 487a  call 0x3dae
    m.call(0x3dae);

    m.push16(0x4880);
    m.step(0x3dc9, 17); // 487d  call 0x3dc9
    m.call(0x3dc9);

    regs.a = 0x96;
    m.step(0x4882, 7); // 4880  ld a,0x96

    mem.write8(0x8057, regs.a);
    m.step(0x4885, 13); // 4882  ld (0x8057),a

    regs.a = 0x08;
    m.step(0x4887, 7); // 4885  ld a,0x08

    mem.write8(0x8055, regs.a);
    m.step(0x488a, 13); // 4887  ld (0x8055),a

    regs.ix = 0x49c2;
    m.step(0x488e, 14); // 488a  ld ix,0x49c2

    m.push16(0x4891);
    m.step(0x3dea, 17); // 488e  call 0x3dea
    m.call(0x3dea);

    // 4891  jp 0x3e01 -- tail-jump (pushes nothing; 0x3e01's ret returns to OUR caller)
    m.step(0x3e01, 10);
    return m.call(0x3e01);
  }

  // 4843  jr z not taken (0x802b != 1) -> fall through to 0x4845
  m.step(0x4845, 7);

  regs.a = 0x0b;
  m.step(0x4847, 7); // 4845  ld a,0x0b

  mem.write8(0x8059, regs.a);
  m.step(0x484a, 13); // 4847  ld (0x8059),a

  m.push16(0x484d);
  m.step(0x3dae, 17); // 484a  call 0x3dae
  m.call(0x3dae);

  m.push16(0x4850);
  m.step(0x3dc9, 17); // 484d  call 0x3dc9
  m.call(0x3dc9);

  regs.a = 0x97;
  m.step(0x4852, 7); // 4850  ld a,0x97

  mem.write8(0x8057, regs.a);
  m.step(0x4855, 13); // 4852  ld (0x8057),a

  regs.a = 0x09;
  m.step(0x4857, 7); // 4855  ld a,0x09

  mem.write8(0x8055, regs.a);
  m.step(0x485a, 13); // 4857  ld (0x8055),a

  regs.ix = 0x49ba;
  m.step(0x485e, 14); // 485a  ld ix,0x49ba

  m.push16(0x4861);
  m.step(0x3dea, 17); // 485e  call 0x3dea
  m.call(0x3dea);

  regs.a = 0x01;
  m.step(0x4863, 7); // 4861  ld a,0x01

  mem.write8(0x8055, regs.a);
  m.step(0x4866, 13); // 4863  ld (0x8055),a

  regs.ix = 0x802b;
  m.step(0x486a, 14); // 4866  ld ix,0x802b

  m.push16(0x486d);
  m.step(0x3dea, 17); // 486a  call 0x3dea
  m.call(0x3dea);

  regs.a = 0x0a;
  m.step(0x486f, 7); // 486d  ld a,0x0a

  mem.write8(0x8055, regs.a);
  m.step(0x4872, 13); // 486f  ld (0x8055),a

  // 4872  jp 0x3e01 -- tail-jump (pushes nothing; 0x3e01's ret returns to OUR caller)
  m.step(0x3e01, 10);
  return m.call(0x3e01);
}
