// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_38c8  (ROM 0x38c8-0x3944, The Pit) -- respawn/reset branch for a
 * left-marching actor, a sibling of the loc_37cf spawn/init and loc_384a
 * animator. It reads the actor's X (0x810a) and forks on it:
 *
 *   - X >= 0x80 (cp 0x80 leaves NC)  -> TAIL-jump loc_3945, the per-frame
 *     move/animate path (its ret unwinds to OUR caller).
 *   - X <  0x80 (X has marched off the left / wrapped low) -> FULL RE-INIT of
 *     the object at the top of its run, then `ret` directly.
 *
 * The re-init seeds the primary object and its twin mirror: X 0x810a=0xf0 /
 * mirror 0x811b=0x00 (0xf0+0x10 wraps), Y 0x810d=0x1f / twin 0x811e=0x1f,
 * twin tile 0x811c=0x2a, primary tile 0x810b=0x2b, 0x810e=0x00, 0x810f=0x01,
 * timer 0x8112=0x01, and 0x810c/0x811d=0x93. It then stamps an 8-cell block
 * into video RAM (via IX=0x93a3) with the tile codes 0xb8..0xbf -- one per cell,
 * bumped by `inc a` between pairs -- and the matching colour RAM (via IY=0x8ba3)
 * all set to the single colour byte 0x97 (B), at the eight (ix/iy + d) offsets
 * {-0x20,-0x1f,0,+1,-0x60,-0x5f,-0x40,-0x3f}. Finally `ret`.
 *
 * FLAGS: `cp 0x80` (0x38cb) sets the carry the `jp nc,0x3945` (0x38cd) reads;
 * cp does not alter A, so the tail path leaves A = the value read from 0x810a.
 * The seven `inc a` between the stamp pairs walk A 0xb8->0xbf (their S/Z/H/PV
 * are dead -- nothing branches on them). All writes land in work / video /
 * colour RAM (none is a hardware address), so none carries a write-bus offset.
 * `jp nc,0x3945` is a TAIL-jump (no pushed return; loc_3945's ret unwinds to our
 * caller), modelled `return m.call(0x3945)` with no trailing m.ret. Role is
 * best-effort from the code; addresses, flags, cycle costs and control flow are
 * exact, one JS statement per Z80 instruction.
 *
 * loc_38c8:
 *   38c8  3a 0a 81     ld   a,(0x810a)
 *   38cb  fe 80        cp   0x80
 *   38cd  d2 45 39     jp   nc,0x3945
 *   38d0  3e f0        ld   a,0xf0
 *   38d2  32 0a 81     ld   (0x810a),a
 *   38d5  c6 10        add  a,0x10
 *   38d7  32 1b 81     ld   (0x811b),a
 *   38da  3e 1f        ld   a,0x1f
 *   38dc  32 0d 81     ld   (0x810d),a
 *   38df  32 1e 81     ld   (0x811e),a
 *   38e2  3e 2a        ld   a,0x2a
 *   38e4  32 1c 81     ld   (0x811c),a
 *   38e7  3e 2b        ld   a,0x2b
 *   38e9  32 0b 81     ld   (0x810b),a
 *   38ec  3e 00        ld   a,0x00
 *   38ee  32 0e 81     ld   (0x810e),a
 *   38f1  3e 01        ld   a,0x01
 *   38f3  32 0f 81     ld   (0x810f),a
 *   38f6  32 12 81     ld   (0x8112),a
 *   38f9  3e 93        ld   a,0x93
 *   38fb  32 0c 81     ld   (0x810c),a
 *   38fe  32 1d 81     ld   (0x811d),a
 *   3901  dd 21 a3 93  ld   ix,0x93a3
 *   3905  fd 21 a3 8b  ld   iy,0x8ba3
 *   3909  06 97        ld   b,0x97
 *   390b  3e b8        ld   a,0xb8
 *   390d  dd 77 e0     ld   (ix-0x20),a
 *   3910  fd 70 e0     ld   (iy-0x20),b
 *   3913  3c           inc  a
 *   3914  dd 77 e1     ld   (ix-0x1f),a
 *   3917  fd 70 e1     ld   (iy-0x1f),b
 *   391a  3c           inc  a
 *   391b  dd 77 00     ld   (ix+0x00),a
 *   391e  fd 70 00     ld   (iy+0x00),b
 *   3921  3c           inc  a
 *   3922  dd 77 01     ld   (ix+0x01),a
 *   3925  fd 70 01     ld   (iy+0x01),b
 *   3928  3c           inc  a
 *   3929  dd 77 a0     ld   (ix-0x60),a
 *   392c  fd 70 a0     ld   (iy-0x60),b
 *   392f  3c           inc  a
 *   3930  dd 77 a1     ld   (ix-0x5f),a
 *   3933  fd 70 a1     ld   (iy-0x5f),b
 *   3936  3c           inc  a
 *   3937  dd 77 c0     ld   (ix-0x40),a
 *   393a  fd 70 c0     ld   (iy-0x40),b
 *   393d  3c           inc  a
 *   393e  dd 77 c1     ld   (ix-0x3f),a
 *   3941  fd 70 c1     ld   (iy-0x3f),b
 *   3944  c9           ret
 */
export function loc_38c8(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x810a); m.step(0x38cb, 13); // 38c8  ld a,(0x810a) -- actor X
  regs.cp(0x80); m.step(0x38cd, 7);               // 38cb  cp 0x80 -- carry iff X < 0x80
  if (regs.fNC) { m.step(0x3945, 10); return m.call(0x3945); } // 38cd  jp nc,0x3945 (X >= 0x80 -> move path, tail out)
  m.step(0x38d0, 10);                             // 38cd  jp nc,0x3945 (not taken -- re-init)

  regs.a = 0xf0; m.step(0x38d2, 7);               // 38d0  ld a,0xf0
  mem.write8(0x810a, regs.a); m.step(0x38d5, 13); // 38d2  ld (0x810a),a -- primary X := 0xf0
  regs.add(0x10); m.step(0x38d7, 7);              // 38d5  add a,0x10 -- A = 0x00 (0xf0+0x10 wraps)
  mem.write8(0x811b, regs.a); m.step(0x38da, 13); // 38d7  ld (0x811b),a -- twin X mirror := 0x00
  regs.a = 0x1f; m.step(0x38dc, 7);               // 38da  ld a,0x1f
  mem.write8(0x810d, regs.a); m.step(0x38df, 13); // 38dc  ld (0x810d),a -- primary Y := 0x1f
  mem.write8(0x811e, regs.a); m.step(0x38e2, 13); // 38df  ld (0x811e),a -- twin Y mirror := 0x1f
  regs.a = 0x2a; m.step(0x38e4, 7);               // 38e2  ld a,0x2a
  mem.write8(0x811c, regs.a); m.step(0x38e7, 13); // 38e4  ld (0x811c),a -- twin tile := 0x2a
  regs.a = 0x2b; m.step(0x38e9, 7);               // 38e7  ld a,0x2b
  mem.write8(0x810b, regs.a); m.step(0x38ec, 13); // 38e9  ld (0x810b),a -- primary tile := 0x2b
  regs.a = 0x00; m.step(0x38ee, 7);               // 38ec  ld a,0x00
  mem.write8(0x810e, regs.a); m.step(0x38f1, 13); // 38ee  ld (0x810e),a := 0x00
  regs.a = 0x01; m.step(0x38f3, 7);               // 38f1  ld a,0x01
  mem.write8(0x810f, regs.a); m.step(0x38f6, 13); // 38f3  ld (0x810f),a := 0x01
  mem.write8(0x8112, regs.a); m.step(0x38f9, 13); // 38f6  ld (0x8112),a -- timer := 0x01 (same A)
  regs.a = 0x93; m.step(0x38fb, 7);               // 38f9  ld a,0x93
  mem.write8(0x810c, regs.a); m.step(0x38fe, 13); // 38fb  ld (0x810c),a := 0x93
  mem.write8(0x811d, regs.a); m.step(0x3901, 13); // 38fe  ld (0x811d),a := 0x93 (same A)
  regs.ix = 0x93a3; m.step(0x3905, 14);           // 3901  ld ix,0x93a3 -- video RAM cursor
  regs.iy = 0x8ba3; m.step(0x3909, 14);           // 3905  ld iy,0x8ba3 -- colour RAM cursor
  regs.b = 0x97; m.step(0x390b, 7);               // 3909  ld b,0x97 -- colour byte
  regs.a = 0xb8; m.step(0x390d, 7);               // 390b  ld a,0xb8 -- first tile code
  mem.write8((regs.ix - 0x20) & 0xffff, regs.a); m.step(0x3910, 19); // 390d  ld (ix-0x20),a -- 0x9383
  mem.write8((regs.iy - 0x20) & 0xffff, regs.b); m.step(0x3913, 19); // 3910  ld (iy-0x20),b -- 0x8b83
  regs.a = regs.inc8(regs.a); m.step(0x3914, 4);  // 3913  inc a -- A = 0xb9
  mem.write8((regs.ix - 0x1f) & 0xffff, regs.a); m.step(0x3917, 19); // 3914  ld (ix-0x1f),a -- 0x9384
  mem.write8((regs.iy - 0x1f) & 0xffff, regs.b); m.step(0x391a, 19); // 3917  ld (iy-0x1f),b -- 0x8b84
  regs.a = regs.inc8(regs.a); m.step(0x391b, 4);  // 391a  inc a -- A = 0xba
  mem.write8((regs.ix + 0x00) & 0xffff, regs.a); m.step(0x391e, 19); // 391b  ld (ix+0x00),a -- 0x93a3
  mem.write8((regs.iy + 0x00) & 0xffff, regs.b); m.step(0x3921, 19); // 391e  ld (iy+0x00),b -- 0x8ba3
  regs.a = regs.inc8(regs.a); m.step(0x3922, 4);  // 3921  inc a -- A = 0xbb
  mem.write8((regs.ix + 0x01) & 0xffff, regs.a); m.step(0x3925, 19); // 3922  ld (ix+0x01),a -- 0x93a4
  mem.write8((regs.iy + 0x01) & 0xffff, regs.b); m.step(0x3928, 19); // 3925  ld (iy+0x01),b -- 0x8ba4
  regs.a = regs.inc8(regs.a); m.step(0x3929, 4);  // 3928  inc a -- A = 0xbc
  mem.write8((regs.ix - 0x60) & 0xffff, regs.a); m.step(0x392c, 19); // 3929  ld (ix-0x60),a -- 0x9343
  mem.write8((regs.iy - 0x60) & 0xffff, regs.b); m.step(0x392f, 19); // 392c  ld (iy-0x60),b -- 0x8b43
  regs.a = regs.inc8(regs.a); m.step(0x3930, 4);  // 392f  inc a -- A = 0xbd
  mem.write8((regs.ix - 0x5f) & 0xffff, regs.a); m.step(0x3933, 19); // 3930  ld (ix-0x5f),a -- 0x9344
  mem.write8((regs.iy - 0x5f) & 0xffff, regs.b); m.step(0x3936, 19); // 3933  ld (iy-0x5f),b -- 0x8b44
  regs.a = regs.inc8(regs.a); m.step(0x3937, 4);  // 3936  inc a -- A = 0xbe
  mem.write8((regs.ix - 0x40) & 0xffff, regs.a); m.step(0x393a, 19); // 3937  ld (ix-0x40),a -- 0x9363
  mem.write8((regs.iy - 0x40) & 0xffff, regs.b); m.step(0x393d, 19); // 393a  ld (iy-0x40),b -- 0x8b63
  regs.a = regs.inc8(regs.a); m.step(0x393e, 4);  // 393d  inc a -- A = 0xbf
  mem.write8((regs.ix - 0x3f) & 0xffff, regs.a); m.step(0x3941, 19); // 393e  ld (ix-0x3f),a -- 0x9364
  mem.write8((regs.iy - 0x3f) & 0xffff, regs.b); m.step(0x3944, 19); // 3941  ld (iy-0x3f),b -- 0x8b64
  return m.ret(); // 3944  ret (10 T; unwinds to our caller)
}
