// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_167f  (ROM 0x167f-0x16b8) — the sibling of loc_1659 for the other axis:
 * derive a tile-row index from the actor's position and dispatch on it.
 *
 * First, a short-circuit: if the lock/flag byte at 0x807f is non-zero, defer the
 * whole frame straight to the record builder at 0x1b5b (tail-jump). Otherwise it
 * pre-loads the sprite code 0x32 into 0x8069, then computes
 *
 *   row = 0x1f - (((mem[0x8068] + E + 0x0b) & 0xff) >> 3)        (E is a caller
 *                                                                 -supplied offset)
 *
 * via `add a,e / add a,0x0b / srl a ×3 / neg / add a,0x1f`, stores it to 0x8073
 * and leaves a copy in H for the callee at 0x16b9. Then it branches on the row:
 *   - row != 7                      -> tail-jump to loc_16b9 (the common path)
 *   - row == 7 and mem[0x8076] == 0 -> tail-jump to loc_16b9
 *   - row == 7 and mem[0x8076] != 0 -> a one-shot event: clear 0x8076 and 0x80bd,
 *                                      set 0x80aa = 0x09, then tail-jump to 0x2bd3
 *
 * The three intermediate `srl a` set carry from the bits shifted out, but `neg`
 * (and then `add a,0x1f`) overwrite the whole flag set before anything reads it,
 * so those carries never reach a branch — modelled faithfully via regs.srl
 * regardless. `cp 0x07` sets the Z the first jr reads; `or a` sets the Z the
 * second reads. Every exit is a jump-out (0x1b5b / 0x16b9 / 0x2bd3), so each is a
 * tail-jump: `return m.call(target)` with no trailing m.ret, and the callee's own
 * ret returns to OUR caller.
 *
 *   167f  3a 7f 80     ld   a,(0x807f)
 *   1682  a7           and  a
 *   1683  c2 5b 1b     jp   nz,0x1b5b
 *   1686  3e 32        ld   a,0x32
 *   1688  32 69 80     ld   (0x8069),a
 *   168b  3a 68 80     ld   a,(0x8068)
 *   168e  83           add  a,e
 *   168f  c6 0b        add  a,0x0b
 *   1691  cb 3f        srl  a
 *   1693  cb 3f        srl  a
 *   1695  cb 3f        srl  a
 *   1697  ed 44        neg
 *   1699  c6 1f        add  a,0x1f
 *   169b  32 73 80     ld   (0x8073),a
 *   169e  67           ld   h,a
 *   169f  fe 07        cp   0x07
 *   16a1  20 16        jr   nz,0x16b9
 *   16a3  3a 76 80     ld   a,(0x8076)
 *   16a6  b7           or   a
 *   16a7  28 10        jr   z,0x16b9
 *   16a9  3e 00        ld   a,0x00
 *   16ab  32 76 80     ld   (0x8076),a
 *   16ae  32 bd 80     ld   (0x80bd),a
 *   16b1  3e 09        ld   a,0x09
 *   16b3  32 aa 80     ld   (0x80aa),a
 *   16b6  c3 d3 2b     jp   0x2bd3
 */
export function loc_167f(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x807f);
  m.step(0x1682, 13); // ld a,(0x807f) -- the lock/flag byte
  regs.and(regs.a);
  m.step(0x1683, 4); // and a -- test it; Z set iff 0x807f == 0
  if (regs.fNZ) {
    m.step(0x1b5b, 10); // jp nz taken -- flagged this frame, defer to the record builder
    return m.call(0x1b5b);
  }
  m.step(0x1686, 10); // jp nz not taken

  regs.a = 0x32;
  m.step(0x1688, 7); // ld a,0x32
  mem.write8(0x8069, regs.a);
  m.step(0x168b, 13); // ld (0x8069),a -- pre-load the sprite code
  regs.a = mem.read8(0x8068);
  m.step(0x168e, 13); // ld a,(0x8068) -- the actor position
  regs.add(regs.e);
  m.step(0x168f, 4); // add a,e -- caller-supplied offset
  regs.add(0x0b);
  m.step(0x1691, 7); // add a,0x0b -- rounding bias
  regs.a = regs.srl(regs.a);
  m.step(0x1693, 8); // srl a
  regs.a = regs.srl(regs.a);
  m.step(0x1695, 8); // srl a
  regs.a = regs.srl(regs.a);
  m.step(0x1697, 8); // srl a -- A = (pos + E + 0x0b) >> 3
  regs.neg();
  m.step(0x1699, 8); // neg
  regs.add(0x1f);
  m.step(0x169b, 7); // add a,0x1f -- A = 0x1f - (that >> 3): the tile row
  mem.write8(0x8073, regs.a);
  m.step(0x169e, 13); // ld (0x8073),a -- store the row
  regs.h = regs.a;
  m.step(0x169f, 4); // ld h,a -- keep a copy in H for loc_16b9
  regs.cp(0x07);
  m.step(0x16a1, 7); // cp 0x07 -- Z set iff row == 7
  if (regs.fNZ) {
    m.step(0x16b9, 12); // jr nz taken -- row != 7, the common path
    return m.call(0x16b9);
  }
  m.step(0x16a3, 7); // jr nz not taken -- row == 7

  regs.a = mem.read8(0x8076);
  m.step(0x16a6, 13); // ld a,(0x8076) -- the one-shot event flag
  regs.or(regs.a);
  m.step(0x16a7, 4); // or a -- Z set iff 0x8076 == 0
  if (regs.fZ) {
    m.step(0x16b9, 12); // jr z taken -- event flag clear, common path
    return m.call(0x16b9);
  }
  m.step(0x16a9, 7); // jr z not taken -- row == 7 AND event flag set

  regs.a = 0x00;
  m.step(0x16ab, 7); // ld a,0x00
  mem.write8(0x8076, regs.a);
  m.step(0x16ae, 13); // ld (0x8076),a -- consume the event flag
  mem.write8(0x80bd, regs.a);
  m.step(0x16b1, 13); // ld (0x80bd),a -- clear 0x80bd too
  regs.a = 0x09;
  m.step(0x16b3, 7); // ld a,0x09
  mem.write8(0x80aa, regs.a);
  m.step(0x16b6, 13); // ld (0x80aa),a -- arm 0x80aa = 9

  m.step(0x2bd3, 10); // jp 0x2bd3 -- tail-jump into the event handler
  return m.call(0x2bd3);
}
