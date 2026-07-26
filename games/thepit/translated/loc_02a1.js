// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_02a1  (ROM 0x02a1-0x02c9, The Pit) — sequences the sub-phase byte at
 * (0x8002) and TAIL-JUMPS to the shared work path loc_02ca or to loc_0371.
 *
 * Reached by `jr nz,0x02a1` from 0x028e. It steps (0x8002) through {1,2} gated
 * by the two condition bytes (0x802c)/(0x802d):
 *   - (0x8002)==1  -> bump it to 2; if (0x802d)!=0 tail-jump loc_02ca.
 *   - otherwise    -> set it to 1; if (0x802c)!=0 tail-jump loc_02ca.
 *   - else set it to 2; if (0x802d)==0 tail-jump loc_0371, else fall into loc_02ca.
 * Every exit is a JUMP, not a ret: this routine has NO ret. loc_02ca / loc_0371
 * run and their own `ret` returns to OUR caller — modelled per the thepit
 * convention (loc_4b40 / loc_0066) as `m.step(target,T); return m.call(target)`
 * with no trailing m.ret (a call+ret would push a spurious frame and double-pop).
 * loc_02ca is a SHARED entry (also `jp nz,0x02ca` from 0x029b), so it is its own
 * routine, not inlined here. `and a` is the (X)==0 test; A holds the last-loaded
 * condition byte across it. Work-RAM stores to 0x8002 take no bus offset.
 *
 *   02a1  3a 02 80     ld   a,(0x8002)
 *   02a4  fe 01        cp   0x01
 *   02a6  20 0b        jr   nz,0x02b3
 *   02a8  3c           inc  a
 *   02a9  32 02 80     ld   (0x8002),a
 *   02ac  3a 2d 80     ld   a,(0x802d)
 *   02af  a7           and  a
 *   02b0  c2 ca 02     jp   nz,0x02ca
 * loc_02b3:
 *   02b3  3e 01        ld   a,0x01
 *   02b5  32 02 80     ld   (0x8002),a
 *   02b8  3a 2c 80     ld   a,(0x802c)
 *   02bb  a7           and  a
 *   02bc  20 0c        jr   nz,0x02ca
 *   02be  3e 02        ld   a,0x02
 *   02c0  32 02 80     ld   (0x8002),a
 *   02c3  3a 2d 80     ld   a,(0x802d)
 *   02c6  a7           and  a
 *   02c7  ca 71 03     jp   z,0x0371
 *   ; fall-through -> loc_02ca (tail-jump)
 */
export function loc_02a1(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8002);
  m.step(0x02a4, 13); // ld a,(0x8002) -- the sub-phase byte
  regs.cp(0x01);
  m.step(0x02a6, 7); // cp 0x01 -- Z set iff (0x8002)==1
  if (regs.fNZ) {
    m.step(0x02b3, 12); // jr nz,0x02b3 taken -- (0x8002)!=1
  } else {
    m.step(0x02a8, 7); // jr nz NOT taken -- (0x8002)==1
    regs.a = regs.inc8(regs.a); // A: 1 -> 2
    m.step(0x02a9, 4); // inc a
    mem.write8(0x8002, regs.a); // (0x8002) = 2
    m.step(0x02ac, 13); // ld (0x8002),a
    regs.a = mem.read8(0x802d);
    m.step(0x02af, 13); // ld a,(0x802d)
    regs.and(regs.a); // and a -- Z set iff (0x802d)==0
    m.step(0x02b0, 4);
    if (regs.fNZ) {
      m.step(0x02ca, 10); // jp nz,0x02ca taken -- tail-jump; its ret returns to OUR caller
      return m.call(0x02ca);
    }
    m.step(0x02b3, 10); // jp nz NOT taken -- fall through to loc_02b3
  }

  // loc_02b3:
  regs.a = 0x01;
  m.step(0x02b5, 7); // ld a,0x01
  mem.write8(0x8002, regs.a); // (0x8002) = 1
  m.step(0x02b8, 13); // ld (0x8002),a
  regs.a = mem.read8(0x802c);
  m.step(0x02bb, 13); // ld a,(0x802c)
  regs.and(regs.a); // and a -- Z set iff (0x802c)==0
  m.step(0x02bc, 4);
  if (regs.fNZ) {
    m.step(0x02ca, 12); // jr nz,0x02ca taken -- tail-jump
    return m.call(0x02ca);
  }
  m.step(0x02be, 7); // jr nz NOT taken
  regs.a = 0x02;
  m.step(0x02c0, 7); // ld a,0x02
  mem.write8(0x8002, regs.a); // (0x8002) = 2
  m.step(0x02c3, 13); // ld (0x8002),a
  regs.a = mem.read8(0x802d);
  m.step(0x02c6, 13); // ld a,(0x802d)
  regs.and(regs.a); // and a -- Z set iff (0x802d)==0
  m.step(0x02c7, 4);
  if (regs.fZ) {
    m.step(0x0371, 10); // jp z,0x0371 taken -- tail-jump
    return m.call(0x0371);
  }
  m.step(0x02ca, 10); // jp z NOT taken -- fall through into loc_02ca (tail-jump)
  return m.call(0x02ca);
}
