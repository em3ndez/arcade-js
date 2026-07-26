// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2d6b  (ROM 0x2d6b-0x2da8, The Pit) -- the countdown-expiry "stamp + reset"
 * path reached from loc_2cb7's `jp z,0x2d6b` (when the countdown byte 0x80b1 has
 * reached the reload sentinel 0x40). It uses the object pointer at (0x806e) to
 * stamp a fixed 5-tile glyph into the tilemap and paint a matching 5-cell colour
 * column, then resets two state bytes and tail-jumps to the shared 0x2f71 tail.
 *
 * Two writes off the SAME pointer word (0x806e):
 *   - IX = (0x806e): five fixed tile codes at scattered offsets --
 *       (ix+0x3f)=0x23, (ix+0x1f)=0x18, (ix-0x01)=0x17, (ix-0x21)=0x14, (ix-0x41)=0x3e
 *   - HL = (0x806e) + 0xf800 + 0xffbf  (i.e. pointer - 0x0841): a 5-iteration djnz
 *       loop writing colour value 0x06 at stride 0x20 (one tilemap column apart).
 * Then (0x8078)=0x00 and (0x807c)=0xb4, and `jp 0x2f71`.
 *
 * The `jp 0x2f71` is a TAIL-JUMP: loc_2d6b keeps no frame of its own, so 0x2f71's
 * own `ret` returns to loc_2d6b's caller -- modelled `m.step(0x2f71, 10); return
 * m.call(0x2f71)` with NO trailing m.ret (a second ret would double-pop). (Role is
 * best-effort from the code; the addresses, constants and control flow are exact.)
 *
 *   2d6b  dd 2a 6e 80  ld   ix,(0x806e)
 *   2d6f  3e 23        ld   a,0x23
 *   2d71  dd 77 3f     ld   (ix+0x3f),a
 *   2d74  3e 18        ld   a,0x18
 *   2d76  dd 77 1f     ld   (ix+0x1f),a
 *   2d79  3e 17        ld   a,0x17
 *   2d7b  dd 77 ff     ld   (ix-0x01),a
 *   2d7e  3e 14        ld   a,0x14
 *   2d80  dd 77 df     ld   (ix-0x21),a
 *   2d83  3e 3e        ld   a,0x3e
 *   2d85  dd 77 bf     ld   (ix-0x41),a
 *   2d88  2a 6e 80     ld   hl,(0x806e)
 *   2d8b  01 00 f8     ld   bc,0xf800
 *   2d8e  11 bf ff     ld   de,0xffbf
 *   2d91  09           add  hl,bc
 *   2d92  19           add  hl,de
 *   2d93  11 20 00     ld   de,0x0020
 *   2d96  3e 06        ld   a,0x06
 *   2d98  06 05        ld   b,0x05
 * loc_2d9a:
 *   2d9a  77           ld   (hl),a
 *   2d9b  19           add  hl,de
 *   2d9c  10 fc        djnz 0x2d9a
 *   2d9e  3e 00        ld   a,0x00
 *   2da0  32 78 80     ld   (0x8078),a
 *   2da3  3e b4        ld   a,0xb4
 *   2da5  32 7c 80     ld   (0x807c),a
 *   2da8  c3 71 2f     jp   0x2f71
 */
export function loc_2d6b(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff; // effective address for (ix+d)

  // 2d6b  ld ix,(0x806e) -- the object/tilemap pointer for this glyph
  regs.ix = mem.read16(0x806e);
  m.step(0x2d6f, 20);
  // 2d6f  ld a,0x23
  regs.a = 0x23;
  m.step(0x2d71, 7);
  // 2d71  ld (ix+0x3f),a -- tile code 0x23
  mem.write8(R(0x3f), regs.a);
  m.step(0x2d74, 19);
  // 2d74  ld a,0x18
  regs.a = 0x18;
  m.step(0x2d76, 7);
  // 2d76  ld (ix+0x1f),a -- tile code 0x18
  mem.write8(R(0x1f), regs.a);
  m.step(0x2d79, 19);
  // 2d79  ld a,0x17
  regs.a = 0x17;
  m.step(0x2d7b, 7);
  // 2d7b  ld (ix-0x01),a -- tile code 0x17
  mem.write8(R(-0x01), regs.a);
  m.step(0x2d7e, 19);
  // 2d7e  ld a,0x14
  regs.a = 0x14;
  m.step(0x2d80, 7);
  // 2d80  ld (ix-0x21),a -- tile code 0x14
  mem.write8(R(-0x21), regs.a);
  m.step(0x2d83, 19);
  // 2d83  ld a,0x3e
  regs.a = 0x3e;
  m.step(0x2d85, 7);
  // 2d85  ld (ix-0x41),a -- tile code 0x3e
  mem.write8(R(-0x41), regs.a);
  m.step(0x2d88, 19);
  // 2d88  ld hl,(0x806e) -- same pointer word, now for the colour column
  regs.hl = mem.read16(0x806e);
  m.step(0x2d8b, 16);
  // 2d8b  ld bc,0xf800
  regs.bc = 0xf800;
  m.step(0x2d8e, 10);
  // 2d8e  ld de,0xffbf
  regs.de = 0xffbf;
  m.step(0x2d91, 10);
  // 2d91  add hl,bc
  regs.addHl(regs.bc);
  m.step(0x2d92, 11);
  // 2d92  add hl,de -- HL = (0x806e) + 0xf800 + 0xffbf = pointer - 0x0841
  regs.addHl(regs.de);
  m.step(0x2d93, 11);
  // 2d93  ld de,0x0020 -- column stride (one tilemap column apart)
  regs.de = 0x0020;
  m.step(0x2d96, 10);
  // 2d96  ld a,0x06 -- colour value written to every cell
  regs.a = 0x06;
  m.step(0x2d98, 7);
  // 2d98  ld b,0x05 -- 5 cells
  regs.b = 0x05;
  m.step(0x2d9a, 7);

  // loc_2d9a: paint 5 colour cells at stride 0x20 with 0x06
  for (;;) {
    // 2d9a  ld (hl),a
    mem.write8(regs.hl, regs.a);
    m.step(0x2d9b, 7);
    // 2d9b  add hl,de -- advance one column
    regs.addHl(regs.de);
    m.step(0x2d9c, 11);
    // 2d9c  djnz 0x2d9a -- decrement B (no flags), loop while cells remain
    if (regs.djnz() !== 0) {
      m.step(0x2d9a, 13); // djnz taken -> next cell
      continue;
    }
    m.step(0x2d9e, 8); // djnz not taken -> all 5 cells painted
    break;
  }

  // 2d9e  ld a,0x00
  regs.a = 0x00;
  m.step(0x2da0, 7);
  // 2da0  ld (0x8078),a -- reset state byte 0x8078 to 0
  mem.write8(0x8078, regs.a);
  m.step(0x2da3, 13);
  // 2da3  ld a,0xb4
  regs.a = 0xb4;
  m.step(0x2da5, 7);
  // 2da5  ld (0x807c),a -- reset state byte 0x807c to 0xb4
  mem.write8(0x807c, regs.a);
  m.step(0x2da8, 13);
  // 2da8  jp 0x2f71 -- tail-jump: 0x2f71's ret returns to loc_2d6b's caller
  m.step(0x2f71, 10);
  return m.call(0x2f71);
}
