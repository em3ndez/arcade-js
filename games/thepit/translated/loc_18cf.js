// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_18cf  (ROM 0x18cf-0x191e, The Pit) — the tile-boundary "prize / special
 * tile" arm of the actor-movement dispatch. E is the actor's position
 * accumulator and B is the tile code sitting under it. The routine acts only on
 * an 8-unit tile boundary (`(E+1) & 7 == 0`); every other phase, and every tile
 * code it does not recognise, tail-jumps to loc_191f (the rest of the tile
 * dispatch). On a boundary it recognises three cases and, in each, awards score,
 * bumps a per-kind counter, blanks the cell the actor stands on to tile 0x70,
 * and continues at loc_19d0:
 *
 *   tile 0x3a          -> call loc_467b (+10, sound 0x10); mem[0x8081]++      -> 0x1913
 *   tile 0x3b/3c/3d    -> only when mem[0x8076] != 0 (feature enabled); a
 *                         one-shot latch guards it: if mem[0x8078] is already
 *                         set, award straight away; else it awards (and sets the
 *                         latch to 1) ONLY when mem[0x80bd] == 0, otherwise bails
 *                         to loc_191f; the award is call loc_4683 (+20); mem[0x8082]++
 *   0x1913 (shared)    -> ix = mem[0x806e] (the actor's video cell pointer);
 *                         (ix+0) = 0x70 (blank tile); jp 0x19d0
 *
 * Both `call`s return here and execution continues. The two terminal transfers
 * (`jr nz/jr z/... 0x191f` and the closing `jp 0x19d0`) are tail-jumps that push
 * nothing, so the callee's own `ret` returns to OUR caller — modelled
 * `m.step(target,t); return m.call(target)` with NO trailing m.ret (a second ret
 * would double-pop). The internal forward jumps (to 0x18e6/0x18f9/0x1909/0x1913)
 * are modelled with labelled JS blocks + `break`. `and a` / `or a` are the
 * zero-tests; `inc a` after `or a` (at 0x1905) increments a value the branch just
 * proved to be 0, so it stores exactly 1.
 *
 *   18cf  7b           ld   a,e
 *   18d0  3c           inc  a
 *   18d1  e6 07        and  0x07
 *   18d3  20 4a        jr   nz,0x191f
 *   18d5  78           ld   a,b
 *   18d6  fe 3a        cp   0x3a
 *   18d8  20 0c        jr   nz,0x18e6
 *   18da  cd 7b 46     call 0x467b
 *   18dd  3a 81 80     ld   a,(0x8081)
 *   18e0  3c           inc  a
 *   18e1  32 81 80     ld   (0x8081),a
 *   18e4  18 2d        jr   0x1913
 * loc_18e6:
 *   18e6  3a 76 80     ld   a,(0x8076)
 *   18e9  a7           and  a
 *   18ea  28 33        jr   z,0x191f
 *   18ec  78           ld   a,b
 *   18ed  fe 3b        cp   0x3b
 *   18ef  28 08        jr   z,0x18f9
 *   18f1  fe 3c        cp   0x3c
 *   18f3  28 04        jr   z,0x18f9
 *   18f5  fe 3d        cp   0x3d
 *   18f7  20 26        jr   nz,0x191f
 * loc_18f9:
 *   18f9  3a 78 80     ld   a,(0x8078)
 *   18fc  b7           or   a
 *   18fd  20 0a        jr   nz,0x1909
 *   18ff  3a bd 80     ld   a,(0x80bd)
 *   1902  b7           or   a
 *   1903  20 1a        jr   nz,0x191f
 *   1905  3c           inc  a
 *   1906  32 78 80     ld   (0x8078),a
 * loc_1909:
 *   1909  cd 83 46     call 0x4683
 *   190c  3a 82 80     ld   a,(0x8082)
 *   190f  3c           inc  a
 *   1910  32 82 80     ld   (0x8082),a
 * loc_1913:
 *   1913  dd 2a 6e 80  ld   ix,(0x806e)
 *   1917  3e 70        ld   a,0x70
 *   1919  dd 77 00     ld   (ix+0x00),a
 *   191c  c3 d0 19     jp   0x19d0
 */
export function loc_18cf(m) {
  const { regs, mem } = m;

  blkG: {
    blkE: {
      blkD: {
        blkC: {
          // ---- Block A (0x18cf): fire only on an 8-unit tile boundary ----
          regs.a = regs.e;
          m.step(0x18d0, 4); // 18cf  ld a,e -- actor position accumulator
          regs.a = regs.inc8(regs.a);
          m.step(0x18d1, 4); // 18d0  inc a
          regs.and(0x07);
          m.step(0x18d3, 7); // 18d1  and 0x07 -- Z set iff (E+1) is a multiple of 8
          if (regs.fNZ) {
            m.step(0x191f, 12); // 18d3  jr nz taken -- not a boundary; on to loc_191f
            return m.call(0x191f);
          }
          m.step(0x18d5, 7); // 18d3  jr nz not taken

          // ---- Block B (0x18d5): tile 0x3a -> +10 & counter 0x8081 ----
          regs.a = regs.b;
          m.step(0x18d6, 4); // 18d5  ld a,b -- tile code under the actor
          regs.cp(0x3a);
          m.step(0x18d8, 7); // 18d6  cp 0x3a
          if (regs.fNZ) {
            m.step(0x18e6, 12); // 18d8  jr nz taken -> the 0x3b/3c/3d arm
            break blkC;
          }
          m.step(0x18da, 7); // 18d8  jr nz not taken -- tile == 0x3a
          m.push16(0x18dd);
          m.step(0x467b, 17); // 18da  call 0x467b -- award +10 (sound 0x10)
          m.call(0x467b);
          regs.a = mem.read8(0x8081);
          m.step(0x18e0, 13); // 18dd  ld a,(0x8081)
          regs.a = regs.inc8(regs.a);
          m.step(0x18e1, 4); // 18e0  inc a
          mem.write8(0x8081, regs.a);
          m.step(0x18e4, 13); // 18e1  ld (0x8081),a -- bump the 0x3a-kind counter
          m.step(0x1913, 12); // 18e4  jr 0x1913 -- to the shared cell-blank tail
          break blkG;
        }

        // ---- Block C (0x18e6): tile 0x3b/0x3c/0x3d, gated on feature 0x8076 ----
        regs.a = mem.read8(0x8076);
        m.step(0x18e9, 13); // 18e6  ld a,(0x8076) -- feature-enabled flag
        regs.and(regs.a);
        m.step(0x18ea, 4); // 18e9  and a -- Z iff disabled
        if (regs.fZ) {
          m.step(0x191f, 12); // 18ea  jr z taken -- disabled; on to loc_191f
          return m.call(0x191f);
        }
        m.step(0x18ec, 7); // 18ea  jr z not taken
        regs.a = regs.b;
        m.step(0x18ed, 4); // 18ec  ld a,b
        regs.cp(0x3b);
        m.step(0x18ef, 7); // 18ed  cp 0x3b
        if (regs.fZ) {
          m.step(0x18f9, 12); // 18ef  jr z taken -- tile 0x3b
          break blkD;
        }
        m.step(0x18f1, 7); // 18ef  jr z not taken
        regs.cp(0x3c);
        m.step(0x18f3, 7); // 18f1  cp 0x3c
        if (regs.fZ) {
          m.step(0x18f9, 12); // 18f3  jr z taken -- tile 0x3c
          break blkD;
        }
        m.step(0x18f5, 7); // 18f3  jr z not taken
        regs.cp(0x3d);
        m.step(0x18f7, 7); // 18f5  cp 0x3d
        if (regs.fNZ) {
          m.step(0x191f, 12); // 18f7  jr nz taken -- unrecognised tile; on to loc_191f
          return m.call(0x191f);
        }
        m.step(0x18f9, 7); // 18f7  jr nz not taken -- tile 0x3d; fall into Block D
      }

      // ---- Block D (0x18f9): the one-shot latch for the 0x3b/3c/3d prize ----
      regs.a = mem.read8(0x8078);
      m.step(0x18fc, 13); // 18f9  ld a,(0x8078) -- latch byte
      regs.or(regs.a);
      m.step(0x18fd, 4); // 18fc  or a -- NZ iff already latched
      if (regs.fNZ) {
        m.step(0x1909, 12); // 18fd  jr nz taken -- already latched; award directly
        break blkE;
      }
      m.step(0x18ff, 7); // 18fd  jr nz not taken -- first time
      regs.a = mem.read8(0x80bd);
      m.step(0x1902, 13); // 18ff  ld a,(0x80bd) -- guard condition
      regs.or(regs.a);
      m.step(0x1903, 4); // 1902  or a
      if (regs.fNZ) {
        m.step(0x191f, 12); // 1903  jr nz taken -- guard set; skip the award, on to loc_191f
        return m.call(0x191f);
      }
      m.step(0x1905, 7); // 1903  jr nz not taken -- A is 0 here
      regs.a = regs.inc8(regs.a);
      m.step(0x1906, 4); // 1905  inc a -- A := 1
      mem.write8(0x8078, regs.a);
      m.step(0x1909, 13); // 1906  ld (0x8078),a -- set the latch to 1; fall into Block E

      // (falls through to Block E)
    }

    // ---- Block E (0x1909): award +20 & counter 0x8082 ----
    m.push16(0x190c);
    m.step(0x4683, 17); // 1909  call 0x4683 -- award +20
    m.call(0x4683);
    regs.a = mem.read8(0x8082);
    m.step(0x190f, 13); // 190c  ld a,(0x8082)
    regs.a = regs.inc8(regs.a);
    m.step(0x1910, 4); // 190f  inc a
    mem.write8(0x8082, regs.a);
    m.step(0x1913, 13); // 1910  ld (0x8082),a -- bump the 0x3b/3c/3d counter; fall into Block G

    // (falls through to Block G)
  }

  // ---- Block G (0x1913): blank the cell the actor stands on, then continue ----
  regs.ix = mem.read16(0x806e);
  m.step(0x1917, 20); // 1913  ld ix,(0x806e) -- the actor's video-RAM cell pointer
  regs.a = 0x70;
  m.step(0x1919, 7); // 1917  ld a,0x70 -- blank tile id
  mem.write8((regs.ix + 0x00) & 0xffff, regs.a);
  m.step(0x191c, 19); // 1919  ld (ix+0x00),a -- overwrite the collected tile with blank
  m.step(0x19d0, 10); // 191c  jp 0x19d0 -- tail-jump into the movement continuation
  return m.call(0x19d0);
}
