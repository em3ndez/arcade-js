// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_46af  (ROM 0x46AF-0x46F3, The Pit) -- writes four digit tiles into a
 * video-RAM column-group selected by 0x8002, split from the two packed bytes
 * 0x8031 and 0x8034, with leading-zero blanking (tile 0x24) on the 0x8034 pair.
 *
 * 0x8002 picks the VRAM base: ==1 -> ix=0x9301, else ix=0x90c1. Then:
 *   (ix+0x00) = (0x8031) & 0x0f       ; low nibble
 *   (ix+0x20) = (0x8031) >> 4         ; high nibble
 *   (ix+0x60) = (0x8034) >> 4, or 0x24 when that nibble is 0 (blank)
 *   (ix+0x40) = (0x8034) & 0x0f, or the same blank iff the high nibble was 0
 * (Role best-effort from the code; addresses, T-states, flags and control flow
 * are exact.)
 *
 * sub_46af:
 *   46af  3a 02 80     ld   a,(0x8002)
 *   46b2  3d           dec  a
 *   46b3  20 06        jr   nz,0x46bb
 *   46b5  dd 21 01 93  ld   ix,0x9301
 *   46b9  18 04        jr   0x46bf
 * loc_46bb:
 *   46bb  dd 21 c1 90  ld   ix,0x90c1
 * loc_46bf:
 *   46bf  3a 31 80     ld   a,(0x8031)
 *   46c2  4f           ld   c,a
 *   46c3  e6 0f        and  0x0f
 *   46c5  dd 77 00     ld   (ix+0x00),a
 *   46c8  79           ld   a,c
 *   46c9  cb 3f        srl  a
 *   46cb  cb 3f        srl  a
 *   46cd  cb 3f        srl  a
 *   46cf  cb 3f        srl  a
 *   46d1  dd 77 20     ld   (ix+0x20),a
 *   46d4  3a 34 80     ld   a,(0x8034)
 *   46d7  4f           ld   c,a
 *   46d8  06 00        ld   b,0x00
 *   46da  cb 3f        srl  a
 *   46dc  cb 3f        srl  a
 *   46de  cb 3f        srl  a
 *   46e0  cb 3f        srl  a
 *   46e2  20 03        jr   nz,0x46e7
 *   46e4  3e 24        ld   a,0x24
 *   46e6  47           ld   b,a
 * loc_46e7:
 *   46e7  dd 77 60     ld   (ix+0x60),a
 *   46ea  79           ld   a,c
 *   46eb  e6 0f        and  0x0f
 *   46ed  20 01        jr   nz,0x46f0
 *   46ef  78           ld   a,b
 * loc_46f0:
 *   46f0  dd 77 40     ld   (ix+0x40),a
 *   46f3  c9           ret
 */
export function sub_46af(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8002);
  m.step(0x46b2, 13); // ld a,(0x8002)
  regs.a = regs.dec8(regs.a);
  m.step(0x46b3, 4); // dec a
  if (regs.fNZ) {
    m.step(0x46bb, 12); // jr nz,0x46bb taken
    regs.ix = 0x90c1;
    m.step(0x46bf, 14); // ld ix,0x90c1
  } else {
    m.step(0x46b5, 7); // jr nz not taken
    regs.ix = 0x9301;
    m.step(0x46b9, 14); // ld ix,0x9301
    m.step(0x46bf, 12); // jr 0x46bf
  }

  // loc_46bf: split the low byte 0x8031 into its two nibbles.
  regs.a = mem.read8(0x8031);
  m.step(0x46c2, 13); // ld a,(0x8031)
  regs.c = regs.a;
  m.step(0x46c3, 4); // ld c,a
  regs.and(0x0f);
  m.step(0x46c5, 7); // and 0x0f
  mem.write8((regs.ix + 0x00) & 0xffff, regs.a);
  m.step(0x46c8, 19); // ld (ix+0x00),a  -- low nibble
  regs.a = regs.c;
  m.step(0x46c9, 4); // ld a,c
  regs.a = regs.srl(regs.a);
  m.step(0x46cb, 8); // srl a
  regs.a = regs.srl(regs.a);
  m.step(0x46cd, 8); // srl a
  regs.a = regs.srl(regs.a);
  m.step(0x46cf, 8); // srl a
  regs.a = regs.srl(regs.a);
  m.step(0x46d1, 8); // srl a  -- a = (0x8031) >> 4
  mem.write8((regs.ix + 0x20) & 0xffff, regs.a);
  m.step(0x46d4, 19); // ld (ix+0x20),a  -- high nibble

  // second byte 0x8034: high nibble with leading-zero blanking.
  regs.a = mem.read8(0x8034);
  m.step(0x46d7, 13); // ld a,(0x8034)
  regs.c = regs.a;
  m.step(0x46d8, 4); // ld c,a
  regs.b = 0x00;
  m.step(0x46da, 7); // ld b,0x00
  regs.a = regs.srl(regs.a);
  m.step(0x46dc, 8); // srl a
  regs.a = regs.srl(regs.a);
  m.step(0x46de, 8); // srl a
  regs.a = regs.srl(regs.a);
  m.step(0x46e0, 8); // srl a
  regs.a = regs.srl(regs.a);
  m.step(0x46e2, 8); // srl a  -- a = (0x8034) >> 4, Z if that nibble is 0
  if (regs.fNZ) {
    m.step(0x46e7, 12); // jr nz,0x46e7 taken (high nibble present)
  } else {
    m.step(0x46e4, 7); // jr nz not taken (high nibble 0 -> blank)
    regs.a = 0x24;
    m.step(0x46e6, 7); // ld a,0x24  -- blank tile
    regs.b = regs.a;
    m.step(0x46e7, 4); // ld b,a  -- remember blank for the low digit
  }

  // loc_46e7:
  mem.write8((regs.ix + 0x60) & 0xffff, regs.a);
  m.step(0x46ea, 19); // ld (ix+0x60),a
  regs.a = regs.c;
  m.step(0x46eb, 4); // ld a,c
  regs.and(0x0f);
  m.step(0x46ed, 7); // and 0x0f  -- low nibble of 0x8034, Z if 0
  if (regs.fNZ) {
    m.step(0x46f0, 12); // jr nz,0x46f0 taken (low nibble present)
  } else {
    m.step(0x46ef, 7); // jr nz not taken (low nibble 0)
    regs.a = regs.b;
    m.step(0x46f0, 4); // ld a,b  -- blank iff the high nibble was also blank
  }

  // loc_46f0:
  mem.write8((regs.ix + 0x40) & 0xffff, regs.a);
  m.step(0x46f3, 19); // ld (ix+0x40),a
  m.ret(10); // ret
}
