// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1659  (ROM 0x1659-0x167e) — recompute one actor's position relative to a
 * reference point, then derive its animation phase, a movement flag and a sprite
 * code before handing off to the record builder at 0x1b5b.
 *
 * Steps:
 *   E        = mem[0x806c]                      (the reference point)
 *   0x8068   = mem[0x8068] - E                  (position relative to reference)
 *   phase    = (0x8068 + 3) & 0x07              (0..7, kept in E)
 *   0x8075   = (phase == 0) ? 0x00 : 0xff       (moving flag: 0 only on phase 0)
 *   0x8069   = (phase & 0x02) ? 0xb3 : 0xb2     (sprite code, alternates on bit 1)
 *   then     jp 0x1b5b                          (build the display record)
 *
 * Both `jr z` reads a Z flag set by a PRECEDING `and`, not by the instruction
 * just before it: the first branches on `and 0x07` (with `ld e,a` in between,
 * which touches no flags); the second branches on `and 0x02` (with `ld a,0xb2`
 * in between — the pre-loaded sprite code, likewise flag-neutral). The pre-load
 * is why A already holds 0xb2 when that jr is taken; only the fall-through arm
 * overwrites it with 0xb3.
 *
 * The closing `jp 0x1b5b` is a tail-jump: modelled as `return m.call(0x1b5b)`
 * with no trailing m.ret, so 0x1b5b's own ret returns to OUR caller.
 *
 *   1659  3a 6c 80     ld   a,(0x806c)
 *   165c  5f           ld   e,a
 *   165d  3a 68 80     ld   a,(0x8068)
 *   1660  93           sub  e
 *   1661  32 68 80     ld   (0x8068),a
 *   1664  c6 03        add  a,0x03
 *   1666  e6 07        and  0x07
 *   1668  5f           ld   e,a
 *   1669  28 02        jr   z,0x166d
 *   166b  3e ff        ld   a,0xff
 *   166d  32 75 80     ld   (0x8075),a
 *   1670  7b           ld   a,e
 *   1671  e6 02        and  0x02
 *   1673  3e b2        ld   a,0xb2
 *   1675  28 02        jr   z,0x1679
 *   1677  3e b3        ld   a,0xb3
 *   1679  32 69 80     ld   (0x8069),a
 *   167c  c3 5b 1b     jp   0x1b5b
 */
export function loc_1659(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x806c);
  m.step(0x165c, 13); // ld a,(0x806c) -- the reference point
  regs.e = regs.a;
  m.step(0x165d, 4); // ld e,a
  regs.a = mem.read8(0x8068);
  m.step(0x1660, 13); // ld a,(0x8068) -- the actor position
  regs.sub(regs.e);
  m.step(0x1661, 4); // sub e -- position relative to reference
  mem.write8(0x8068, regs.a);
  m.step(0x1664, 13); // ld (0x8068),a -- store it back
  regs.add(0x03);
  m.step(0x1666, 7); // add a,0x03 -- rounding bias
  regs.and(0x07);
  m.step(0x1668, 7); // and 0x07 -- phase 0..7; Z set iff phase == 0
  regs.e = regs.a;
  m.step(0x1669, 4); // ld e,a -- keep phase in E (touches no flags)
  if (regs.fZ) {
    m.step(0x166d, 12); // jr z taken -- phase 0, A stays 0
  } else {
    m.step(0x166b, 7); // jr z not taken
    regs.a = 0xff;
    m.step(0x166d, 7); // ld a,0xff
  }

  mem.write8(0x8075, regs.a);
  m.step(0x1670, 13); // ld (0x8075),a -- moving flag (0 on phase 0, else 0xff)
  regs.a = regs.e;
  m.step(0x1671, 4); // ld a,e -- phase back into A
  regs.and(0x02);
  m.step(0x1673, 7); // and 0x02 -- test bit 1 of phase; Z set iff bit 1 clear
  regs.a = 0xb2;
  m.step(0x1675, 7); // ld a,0xb2 -- pre-load sprite code (touches no flags)
  if (regs.fZ) {
    m.step(0x1679, 12); // jr z taken -- bit 1 clear, keep 0xb2
  } else {
    m.step(0x1677, 7); // jr z not taken
    regs.a = 0xb3;
    m.step(0x1679, 7); // ld a,0xb3 -- bit 1 set, use 0xb3
  }

  mem.write8(0x8069, regs.a);
  m.step(0x167c, 13); // ld (0x8069),a -- store the sprite code

  m.step(0x1b5b, 10); // jp 0x1b5b -- tail-jump to the record builder
  return m.call(0x1b5b);
}
