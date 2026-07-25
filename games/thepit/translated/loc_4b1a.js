// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_4b1a  (ROM 0x4b1a–0x4b3b, The Pit) — advances the 16-bit pseudo-random
 * value held little-endian at 0x800d (low = C) / 0x800e (high = B) by one
 * shift-register step, reseeding C = 0x02 first if the whole value is zero so the
 * generator never locks up on all-zero (the DK sub_0057 role, done as an LFSR).
 *
 *   4b1a  3a 0d 80     ld   a,(0x800d)
 *   4b1d  4f           ld   c,a          ; C = low byte
 *   4b1e  3a 0e 80     ld   a,(0x800e)
 *   4b21  47           ld   b,a          ; B = high byte
 *   4b22  b1           or   c            ; A = B | C -> Z iff value == 0; carry cleared
 *   4b23  20 02        jr   nz,0x4b27    ; value non-zero -> keep C
 *   4b25  0e 02        ld   c,0x02       ; reseed to escape the all-zero lockup
 *
 *   4b27  cb 39        srl  c            ; loc_4b27
 *   4b29  79           ld   a,c
 *   4b2a  cb 3f        srl  a
 *   4b2c  a9           xor  c            ; feedback tap; carry cleared
 *   4b2d  cb 21        sla  c
 *   4b2f  cb 3f        srl  a            ; carry := feedback bit for the rra chain
 *   4b31  78           ld   a,b
 *   4b32  1f           rra               ; rotate high byte right through the feedback carry
 *   4b33  32 0e 80     ld   (0x800e),a   ; store new high byte
 *   4b36  79           ld   a,c
 *   4b37  1f           rra               ; rotate low byte right through the carry from above
 *   4b38  32 0d 80     ld   (0x800d),a   ; store new low byte
 *   4b3b  c9           ret
 *
 * The two CB shifts on A (0x4b2a, 0x4b2f) fold C's low bits together with `xor c`
 * into a single feedback bit that lands in carry at 0x4b2f; that carry is then
 * shifted into the high byte by the first `rra`, whose carry-out (the old high-byte
 * bit0) is shifted into the low byte by the second `rra`. The result is written
 * back over the same two bytes it was read from. All flags/carry come from the
 * z80.js helpers (srl/sla/xor/or/rra), never hand-rolled. 0x800d/0x800e are work
 * RAM, so the stores need no hardware write-bus offset.
 */
export function loc_4b1a(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x800d);
  m.step(0x4b1d, 13); // ld a,(0x800d)
  regs.c = regs.a;
  m.step(0x4b1e, 4); // ld c,a -- C = low byte
  regs.a = mem.read8(0x800e);
  m.step(0x4b21, 13); // ld a,(0x800e)
  regs.b = regs.a;
  m.step(0x4b22, 4); // ld b,a -- B = high byte
  regs.or(regs.c); // A = B | C -- Z iff the 16-bit value is zero; carry cleared
  m.step(0x4b23, 4); // or c

  // jr nz,0x4b27 -- skip the reseed unless the value is all-zero.
  if (regs.fNZ) {
    m.step(0x4b27, 12); // jr nz taken -- value non-zero, keep C
  } else {
    m.step(0x4b25, 7); // jr nz NOT taken
    regs.c = 0x02; // ld c,0x02 -- reseed to escape the LFSR all-zero lockup
    m.step(0x4b27, 7); // ld c,0x02
  }

  // loc_4b27: fold a feedback bit into carry, then rotate the 16-bit value right.
  regs.c = regs.srl(regs.c);
  m.step(0x4b29, 8); // srl c -- C >>= 1, carry = old C bit0
  regs.a = regs.c;
  m.step(0x4b2a, 4); // ld a,c
  regs.a = regs.srl(regs.a);
  m.step(0x4b2c, 8); // srl a
  regs.xor(regs.c);
  m.step(0x4b2d, 4); // xor c -- feedback tap; carry cleared here
  regs.c = regs.sla(regs.c);
  m.step(0x4b2f, 8); // sla c -- C <<= 1 (restores C, clearing its bit0)
  regs.a = regs.srl(regs.a);
  m.step(0x4b31, 8); // srl a -- carry := feedback bit fed into the rra chain
  regs.a = regs.b;
  m.step(0x4b32, 4); // ld a,b
  regs.rra();
  m.step(0x4b33, 4); // rra -- high byte >> 1, feedback carry into bit7
  mem.write8(0x800e, regs.a);
  m.step(0x4b36, 13); // ld (0x800e),a -- store new high byte
  regs.a = regs.c;
  m.step(0x4b37, 4); // ld a,c
  regs.rra();
  m.step(0x4b38, 4); // rra -- low byte >> 1, carry from the high-byte rra into bit7
  mem.write8(0x800d, regs.a);
  m.step(0x4b3b, 13); // ld (0x800d),a -- store new low byte

  m.ret(); // ret (0x4b3b)
}
