// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_37cf  (ROM 0x37cf-0x3849, The Pit) -- alt-phase actor spawn/init, reached
 * as a tail-jump from loc_3748 when the alt-phase byte (0x807b) is non-zero.
 *
 * Gated on (0x807b):
 *   - 0xff (already active)  -> TAIL-jump loc_384a (animate the running object)
 *   - anything else          -> FIRST-FRAME INIT of the alt-phase object, then
 *                               TAIL-jump loc_3a4c.
 *
 * The init path derives the object's starting Y from the (0x807b) sub-state:
 * `inc a` then `cp 0x03` sets Z when the ORIGINAL byte was 2, in which case Y is
 * 0x16; otherwise `inc a` bumps it to 0x17. That Y is stored to the primary
 * (0x810d) and its twin mirror (0x811e). It then marks (0x807b)=0xff (active),
 * requests sound 0x07 (call 0x4c6b), and seeds the primary/twin object fields:
 * X 0x810a=0x10 / mirror 0x811b=0x20, tile 0x810b=0x2e / twin 0x811c=0x2f,
 * timer 0x8112=0x01, and 0x810c/0x811d=0x97. Finally it stamps an 8-cell block
 * into video RAM (tile 0x24, via IX=0x93a3) and the matching colour RAM (colour
 * 0x90, via IY=0x8ba3) at the eight (ix/iy + d) offsets, then tail-jumps 0x3a4c.
 *
 * FLAGS: `inc a` (0x37d2) sets the Z read by `jr z,0x384a`; `cp 0x03` (0x37d5)
 * sets the Z read by `jr z,0x37dc` -- the `ld a,0x16` between them touches no
 * flags, so that Z survives. All the object writes land in work / video / colour
 * RAM (none is a hardware address), so none carries a write-bus offset. The
 * `call 0x4c6b` is a REAL call (control returns here); both `jr z,0x384a` and
 * `jp 0x3a4c` are TAIL-jumps -- the callee's ret unwinds to OUR caller, modelled
 * `return m.call(target)` with no trailing m.ret. Role is best-effort from the
 * code; addresses, flags, cycle costs and control flow are exact, one JS
 * statement per Z80 instruction.
 *
 * loc_37cf:
 *   37cf  3a 7b 80     ld   a,(0x807b)
 *   37d2  3c           inc  a
 *   37d3  28 75        jr   z,0x384a
 *   37d5  fe 03        cp   0x03
 *   37d7  3e 16        ld   a,0x16
 *   37d9  28 01        jr   z,0x37dc
 *   37db  3c           inc  a
 * loc_37dc:
 *   37dc  32 0d 81     ld   (0x810d),a
 *   37df  32 1e 81     ld   (0x811e),a
 *   37e2  3e ff        ld   a,0xff
 *   37e4  32 7b 80     ld   (0x807b),a
 *   37e7  cd 6b 4c     call 0x4c6b
 *   37ea  3e 10        ld   a,0x10
 *   37ec  32 0a 81     ld   (0x810a),a
 *   37ef  c6 10        add  a,0x10
 *   37f1  32 1b 81     ld   (0x811b),a
 *   37f4  3e 2e        ld   a,0x2e
 *   37f6  32 0b 81     ld   (0x810b),a
 *   37f9  3e 2f        ld   a,0x2f
 *   37fb  32 1c 81     ld   (0x811c),a
 *   37fe  3e 01        ld   a,0x01
 *   3800  32 12 81     ld   (0x8112),a
 *   3803  3e 97        ld   a,0x97
 *   3805  32 0c 81     ld   (0x810c),a
 *   3808  32 1d 81     ld   (0x811d),a
 *   380b  dd 21 a3 93  ld   ix,0x93a3
 *   380f  fd 21 a3 8b  ld   iy,0x8ba3
 *   3813  06 90        ld   b,0x90
 *   3815  3e 24        ld   a,0x24
 *   3817  dd 77 e0     ld   (ix-0x20),a
 *   381a  fd 70 e0     ld   (iy-0x20),b
 *   381d  dd 77 e1     ld   (ix-0x1f),a
 *   3820  fd 70 e1     ld   (iy-0x1f),b
 *   3823  dd 77 00     ld   (ix+0x00),a
 *   3826  fd 70 00     ld   (iy+0x00),b
 *   3829  dd 77 01     ld   (ix+0x01),a
 *   382c  fd 70 01     ld   (iy+0x01),b
 *   382f  dd 77 a0     ld   (ix-0x60),a
 *   3832  fd 70 a0     ld   (iy-0x60),b
 *   3835  dd 77 a1     ld   (ix-0x5f),a
 *   3838  fd 70 a1     ld   (iy-0x5f),b
 *   383b  dd 77 c0     ld   (ix-0x40),a
 *   383e  fd 70 c0     ld   (iy-0x40),b
 *   3841  dd 77 c1     ld   (ix-0x3f),a
 *   3844  fd 70 c1     ld   (iy-0x3f),b
 *   3847  c3 4c 3a     jp   0x3a4c
 */
export function loc_37cf(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x807b); m.step(0x37d2, 13); // 37cf  ld a,(0x807b) -- alt-phase byte
  regs.a = regs.inc8(regs.a); m.step(0x37d3, 4);  // 37d2  inc a -- Z set iff byte was 0xff
  if (regs.fZ) { m.step(0x384a, 12); return m.call(0x384a); } // 37d3  jr z,0x384a (already active -> tail out)
  m.step(0x37d5, 7); // 37d3  jr z,0x384a (not taken)
  regs.cp(0x03); m.step(0x37d7, 7);   // 37d5  cp 0x03 -- Z iff original byte was 2
  regs.a = 0x16; m.step(0x37d9, 7);   // 37d7  ld a,0x16 -- (no flags; the cp's Z survives)
  if (regs.fZ) {
    m.step(0x37dc, 12); // 37d9  jr z,0x37dc (taken -- keep Y = 0x16)
  } else {
    m.step(0x37db, 7); // 37d9  jr z,0x37dc (not taken)
    regs.a = regs.inc8(regs.a); m.step(0x37dc, 4); // 37db  inc a -- Y = 0x17
  }
  // loc_37dc:
  mem.write8(0x810d, regs.a); m.step(0x37df, 13); // 37dc  ld (0x810d),a -- primary Y
  mem.write8(0x811e, regs.a); m.step(0x37e2, 13); // 37df  ld (0x811e),a -- twin Y mirror
  regs.a = 0xff; m.step(0x37e4, 7);               // 37e2  ld a,0xff
  mem.write8(0x807b, regs.a); m.step(0x37e7, 13); // 37e4  ld (0x807b),a -- mark alt-phase active
  m.push16(0x37ea); m.step(0x4c6b, 17); m.call(0x4c6b); // 37e7  call 0x4c6b -- request sound 0x07 (returns here)
  regs.a = 0x10; m.step(0x37ec, 7);               // 37ea  ld a,0x10
  mem.write8(0x810a, regs.a); m.step(0x37ef, 13); // 37ec  ld (0x810a),a -- primary X
  regs.add(0x10); m.step(0x37f1, 7);              // 37ef  add a,0x10 -- A = 0x20
  mem.write8(0x811b, regs.a); m.step(0x37f4, 13); // 37f1  ld (0x811b),a -- twin X mirror
  regs.a = 0x2e; m.step(0x37f6, 7);               // 37f4  ld a,0x2e
  mem.write8(0x810b, regs.a); m.step(0x37f9, 13); // 37f6  ld (0x810b),a -- primary tile
  regs.a = 0x2f; m.step(0x37fb, 7);               // 37f9  ld a,0x2f
  mem.write8(0x811c, regs.a); m.step(0x37fe, 13); // 37fb  ld (0x811c),a -- twin tile
  regs.a = 0x01; m.step(0x3800, 7);               // 37fe  ld a,0x01
  mem.write8(0x8112, regs.a); m.step(0x3803, 13); // 3800  ld (0x8112),a -- timer
  regs.a = 0x97; m.step(0x3805, 7);               // 3803  ld a,0x97
  mem.write8(0x810c, regs.a); m.step(0x3808, 13); // 3805  ld (0x810c),a
  mem.write8(0x811d, regs.a); m.step(0x380b, 13); // 3808  ld (0x811d),a -- same A (0x97)
  regs.ix = 0x93a3; m.step(0x380f, 14);           // 380b  ld ix,0x93a3 -- video RAM cursor
  regs.iy = 0x8ba3; m.step(0x3813, 14);           // 380f  ld iy,0x8ba3 -- colour RAM cursor
  regs.b = 0x90; m.step(0x3815, 7);               // 3813  ld b,0x90 -- colour byte
  regs.a = 0x24; m.step(0x3817, 7);               // 3815  ld a,0x24 -- tile byte
  mem.write8((regs.ix - 0x20) & 0xffff, regs.a); m.step(0x381a, 19); // 3817  ld (ix-0x20),a
  mem.write8((regs.iy - 0x20) & 0xffff, regs.b); m.step(0x381d, 19); // 381a  ld (iy-0x20),b
  mem.write8((regs.ix - 0x1f) & 0xffff, regs.a); m.step(0x3820, 19); // 381d  ld (ix-0x1f),a
  mem.write8((regs.iy - 0x1f) & 0xffff, regs.b); m.step(0x3823, 19); // 3820  ld (iy-0x1f),b
  mem.write8((regs.ix + 0x00) & 0xffff, regs.a); m.step(0x3826, 19); // 3823  ld (ix+0x00),a
  mem.write8((regs.iy + 0x00) & 0xffff, regs.b); m.step(0x3829, 19); // 3826  ld (iy+0x00),b
  mem.write8((regs.ix + 0x01) & 0xffff, regs.a); m.step(0x382c, 19); // 3829  ld (ix+0x01),a
  mem.write8((regs.iy + 0x01) & 0xffff, regs.b); m.step(0x382f, 19); // 382c  ld (iy+0x01),b
  mem.write8((regs.ix - 0x60) & 0xffff, regs.a); m.step(0x3832, 19); // 382f  ld (ix-0x60),a
  mem.write8((regs.iy - 0x60) & 0xffff, regs.b); m.step(0x3835, 19); // 3832  ld (iy-0x60),b
  mem.write8((regs.ix - 0x5f) & 0xffff, regs.a); m.step(0x3838, 19); // 3835  ld (ix-0x5f),a
  mem.write8((regs.iy - 0x5f) & 0xffff, regs.b); m.step(0x383b, 19); // 3838  ld (iy-0x5f),b
  mem.write8((regs.ix - 0x40) & 0xffff, regs.a); m.step(0x383e, 19); // 383b  ld (ix-0x40),a
  mem.write8((regs.iy - 0x40) & 0xffff, regs.b); m.step(0x3841, 19); // 383e  ld (iy-0x40),b
  mem.write8((regs.ix - 0x3f) & 0xffff, regs.a); m.step(0x3844, 19); // 3841  ld (ix-0x3f),a
  mem.write8((regs.iy - 0x3f) & 0xffff, regs.b); m.step(0x3847, 19); // 3844  ld (iy-0x3f),b
  m.step(0x3a4c, 10); return m.call(0x3a4c); // 3847  jp 0x3a4c (tail out; loc_3a4c's ret -> our caller)
}
