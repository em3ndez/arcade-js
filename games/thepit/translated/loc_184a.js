// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_184a  (ROM 0x184a-0x1869) — advance an actor's position accumulator at
 * 0x8068 by its per-frame delta at 0x806c, derive a sub-tile phase, and pick a
 * 2-frame walk sprite from it before handing the actor block to the record
 * builder loc_1b5b:
 *   mem[0x8068] += mem[0x806c]                 (position accumulates the delta)
 *   mem[0x8075]  = (mem[0x8068] + 3) & 7       (low-3-bit phase, +3 biased)
 *   mem[0x8069]  = (phase & 2) ? 0x33 : 0x32   (alternate the two walk frames)
 * The `and 0x02` tests bit 1 of the phase; `ld a,0x32` is issued BEFORE the
 * branch so A already holds 0x32 on the Z-taken (bit1 clear) path — only the
 * not-taken path overwrites it with 0x33. `ld a,n` touches no flags, so the Z
 * from `and 0x02` survives across it to the `jr z`. The block ends with an
 * unconditional `jp 0x1b5b`: a tail-jump modelled as `return m.call(0x1b5b)`
 * (loc_1b5b's own ret returns to OUR caller), so there is no trailing m.ret.
 *
 *   184a  3a 6c 80     ld   a,(0x806c)
 *   184d  5f           ld   e,a
 *   184e  3a 68 80     ld   a,(0x8068)
 *   1851  83           add  a,e
 *   1852  32 68 80     ld   (0x8068),a
 *   1855  c6 03        add  a,0x03
 *   1857  e6 07        and  0x07
 *   1859  32 75 80     ld   (0x8075),a
 *   185c  e6 02        and  0x02
 *   185e  3e 32        ld   a,0x32
 *   1860  28 02        jr   z,0x1864
 *   1862  3e 33        ld   a,0x33
 *   1864  32 69 80     ld   (0x8069),a
 *   1867  c3 5b 1b     jp   0x1b5b
 */
export function loc_184a(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x806c);
  m.step(0x184d, 13); // ld a,(0x806c) -- the per-frame position delta
  regs.e = regs.a;
  m.step(0x184e, 4); // ld e,a
  regs.a = mem.read8(0x8068);
  m.step(0x1851, 13); // ld a,(0x8068) -- current position accumulator
  regs.add(regs.e);
  m.step(0x1852, 4); // add a,e -- position += delta (8-bit wrap)
  mem.write8(0x8068, regs.a);
  m.step(0x1855, 13); // ld (0x8068),a -- store the advanced position
  regs.add(0x03);
  m.step(0x1857, 7); // add a,0x03 -- bias the phase by +3
  regs.and(0x07);
  m.step(0x1859, 7); // and 0x07 -- keep the low 3 bits (phase 0..7)
  mem.write8(0x8075, regs.a);
  m.step(0x185c, 13); // ld (0x8075),a -- store the phase
  regs.and(0x02);
  m.step(0x185e, 7); // and 0x02 -- test bit 1 of the phase; Z set iff bit1 == 0
  regs.a = 0x32;
  m.step(0x1860, 7); // ld a,0x32 -- pre-loaded frame; does NOT disturb the Z flag
  if (regs.fZ) {
    m.step(0x1864, 12); // jr z taken -- bit1 clear, keep frame 0x32
  } else {
    m.step(0x1862, 7); // jr z not taken -- bit1 set
    regs.a = 0x33;
    m.step(0x1864, 7); // ld a,0x33 -- other walk frame
  }

  mem.write8(0x8069, regs.a);
  m.step(0x1867, 13); // ld (0x8069),a -- store the selected walk frame
  m.step(0x1b5b, 10); // jp 0x1b5b -- tail-jump into the record builder
  return m.call(0x1b5b);
}
