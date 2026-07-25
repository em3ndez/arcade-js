// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_4632  (ROM 0x4632–0x4672, The Pit) — copies 5 fields (stride 3) from the
 * player slot at 0x8028 into the neighbouring slot. Source base is iy=0x8028;
 * the destination is ix=0x8029 when (0x8002)==1, else ix is bumped to 0x802A.
 * So it writes 0x8028+k -> (0x8029|0x802A)+k for k in {0,3,6,9,0xC}.
 *
 *   4632  fd 21 28 80  ld   iy,0x8028
 *   4636  dd 21 29 80  ld   ix,0x8029
 *   463a  3a 02 80     ld   a,(0x8002)
 *   463d  3d           dec  a
 *   463e  28 14        jr   z,0x4654       ; (0x8002)==1 -> keep ix=0x8029
 *   4640  dd 23        inc  ix             ; else dest = 0x802A
 *   4642  18 10        jr   0x4654
 * loc_4654:
 *   4654  fd 7e 00     ld   a,(iy+0x00)
 *   4657  dd 77 00     ld   (ix+0x00),a
 *   465a  fd 7e 03     ld   a,(iy+0x03)
 *   465d  dd 77 03     ld   (ix+0x03),a
 *   4660  fd 7e 06     ld   a,(iy+0x06)
 *   4663  dd 77 06     ld   (ix+0x06),a
 *   4666  fd 7e 09     ld   a,(iy+0x09)
 *   4669  dd 77 09     ld   (ix+0x09),a
 *   466c  fd 7e 0c     ld   a,(iy+0x0c)
 *   466f  dd 77 0c     ld   (ix+0x0c),a
 *   4672  c9           ret
 */
export function loc_4632(m) {
  const { regs, mem } = m;

  regs.iy = 0x8028;
  m.step(0x4636, 14); // ld iy,0x8028 -- source base
  regs.ix = 0x8029;
  m.step(0x463a, 14); // ld ix,0x8029 -- dest base (default)
  regs.a = mem.read8(0x8002);
  m.step(0x463d, 13); // ld a,(0x8002)
  regs.a = regs.dec8(regs.a);
  m.step(0x463e, 4); // dec a -- Z set iff (0x8002)==1
  if (regs.fZ) {
    m.step(0x4654, 12); // jr z,0x4654 taken -- dest stays 0x8029
  } else {
    m.step(0x4640, 7); // jr z NOT taken
    regs.ix = (regs.ix + 1) & 0xffff;
    m.step(0x4642, 10); // inc ix -- dest = 0x802A
    m.step(0x4654, 12); // jr 0x4654
  }

  // loc_4654: copy 5 fields, stride 3, (iy+k) -> (ix+k)
  regs.a = mem.read8((regs.iy + 0x00) & 0xffff);
  m.step(0x4657, 19); // ld a,(iy+0x00)
  mem.write8((regs.ix + 0x00) & 0xffff, regs.a);
  m.step(0x465a, 19); // ld (ix+0x00),a
  regs.a = mem.read8((regs.iy + 0x03) & 0xffff);
  m.step(0x465d, 19); // ld a,(iy+0x03)
  mem.write8((regs.ix + 0x03) & 0xffff, regs.a);
  m.step(0x4660, 19); // ld (ix+0x03),a
  regs.a = mem.read8((regs.iy + 0x06) & 0xffff);
  m.step(0x4663, 19); // ld a,(iy+0x06)
  mem.write8((regs.ix + 0x06) & 0xffff, regs.a);
  m.step(0x4666, 19); // ld (ix+0x06),a
  regs.a = mem.read8((regs.iy + 0x09) & 0xffff);
  m.step(0x4669, 19); // ld a,(iy+0x09)
  mem.write8((regs.ix + 0x09) & 0xffff, regs.a);
  m.step(0x466c, 19); // ld (ix+0x09),a
  regs.a = mem.read8((regs.iy + 0x0c) & 0xffff);
  m.step(0x466f, 19); // ld a,(iy+0x0c)
  mem.write8((regs.ix + 0x0c) & 0xffff, regs.a);
  m.step(0x4672, 19); // ld (ix+0x0c),a

  m.ret(10); // ret (0x4672)
}
