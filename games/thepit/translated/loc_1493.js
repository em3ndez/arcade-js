// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1493  (ROM 0x1493-0x14cc) — one arm of the mode-idle object dispatcher
 * (reached from loc_144c on L bit0). It first bails to 0x1b5b (defer the frame)
 * if the 0x807e busy/defer flag is set. Otherwise it forces the object's byte at
 * 0x8069 to 0xb2, then derives a screen-tile coordinate from the object's
 * position: A = ((0x8068 - E + 3) >> 3) negated, + 0x1f. That coordinate is
 * stored to 0x8073 and mirrored into H. If it equals 0x16 AND the 0x8076 flag is
 * set, the object has reached the boundary: clear 0x8076 and 0x80bd, set
 * 0x80aa = 0x09, and tail-jump to 0x2bd3. Every other path is a tail-jump too —
 * to loc_14cd (coordinate != 0x16, or 0x8076 clear) to continue positioning, or
 * to 0x1b5b when the busy flag was set. `return m.call(target)` throughout: the
 * callee's own ret returns to OUR caller, so there is no trailing m.ret.
 *
 * E is an input (the position delta the caller passes in).
 *
 *   1493  3a 7e 80     ld   a,(0x807e)
 *   1496  a7           and  a
 *   1497  c2 5b 1b     jp   nz,0x1b5b
 *   149a  3e b2        ld   a,0xb2
 *   149c  32 69 80     ld   (0x8069),a
 *   149f  3a 68 80     ld   a,(0x8068)
 *   14a2  93           sub  e
 *   14a3  c6 03        add  a,0x03
 *   14a5  cb 3f        srl  a
 *   14a7  cb 3f        srl  a
 *   14a9  cb 3f        srl  a
 *   14ab  ed 44        neg
 *   14ad  c6 1f        add  a,0x1f
 *   14af  32 73 80     ld   (0x8073),a
 *   14b2  67           ld   h,a
 *   14b3  fe 16        cp   0x16
 *   14b5  20 16        jr   nz,0x14cd
 *   14b7  3a 76 80     ld   a,(0x8076)
 *   14ba  b7           or   a
 *   14bb  28 10        jr   z,0x14cd
 *   14bd  3e 00        ld   a,0x00
 *   14bf  32 76 80     ld   (0x8076),a
 *   14c2  32 bd 80     ld   (0x80bd),a
 *   14c5  3e 09        ld   a,0x09
 *   14c7  32 aa 80     ld   (0x80aa),a
 *   14ca  c3 d3 2b     jp   0x2bd3
 */
export function loc_1493(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x807e);
  m.step(0x1496, 13); // ld a,(0x807e) -- the busy/defer flag
  regs.and(regs.a);
  m.step(0x1497, 4); // and a -- test it
  if (regs.fNZ) {
    m.step(0x1b5b, 10); // jp nz taken -- busy, defer the frame
    return m.call(0x1b5b);
  }
  m.step(0x149a, 10); // jp nz not taken

  regs.a = 0xb2;
  m.step(0x149c, 7); // ld a,0xb2
  mem.write8(0x8069, regs.a);
  m.step(0x149f, 13); // ld (0x8069),a -- force the object byte to 0xb2

  regs.a = mem.read8(0x8068);
  m.step(0x14a2, 13); // ld a,(0x8068) -- object position
  regs.sub(regs.e);
  m.step(0x14a3, 4); // sub e -- minus the caller's delta
  regs.add(0x03);
  m.step(0x14a5, 7); // add a,0x03 -- rounding bias before the /8
  regs.a = regs.srl(regs.a);
  m.step(0x14a7, 8); // srl a
  regs.a = regs.srl(regs.a);
  m.step(0x14a9, 8); // srl a
  regs.a = regs.srl(regs.a);
  m.step(0x14ab, 8); // srl a -- A = (0x8068 - E + 3) >> 3
  regs.neg();
  m.step(0x14ad, 8); // neg -- A = -A
  regs.add(0x1f);
  m.step(0x14af, 7); // add a,0x1f -- A = 0x1f - ((0x8068 - E + 3) >> 3)
  mem.write8(0x8073, regs.a);
  m.step(0x14b2, 13); // ld (0x8073),a -- store the tile coordinate
  regs.h = regs.a;
  m.step(0x14b3, 4); // ld h,a -- mirror it into H
  regs.cp(0x16);
  m.step(0x14b5, 7); // cp 0x16 -- at the boundary row?
  if (regs.fNZ) {
    m.step(0x14cd, 12); // jr nz taken -- not the boundary, continue positioning
    return m.call(0x14cd);
  }
  m.step(0x14b7, 7); // jr nz not taken

  regs.a = mem.read8(0x8076);
  m.step(0x14ba, 13); // ld a,(0x8076) -- boundary-armed flag
  regs.or(regs.a);
  m.step(0x14bb, 4); // or a -- test it
  if (regs.fZ) {
    m.step(0x14cd, 12); // jr z taken -- flag clear, continue positioning
    return m.call(0x14cd);
  }
  m.step(0x14bd, 7); // jr z not taken -- boundary reached with the flag armed

  regs.a = 0x00;
  m.step(0x14bf, 7); // ld a,0x00
  mem.write8(0x8076, regs.a);
  m.step(0x14c2, 13); // ld (0x8076),a -- disarm the boundary flag
  mem.write8(0x80bd, regs.a);
  m.step(0x14c5, 13); // ld (0x80bd),a -- clear 0x80bd too
  regs.a = 0x09;
  m.step(0x14c7, 7); // ld a,0x09
  mem.write8(0x80aa, regs.a);
  m.step(0x14ca, 13); // ld (0x80aa),a -- kick 0x80aa to 9

  m.step(0x2bd3, 10); // jp 0x2bd3 -- hand off (boundary handler)
  return m.call(0x2bd3);
}
