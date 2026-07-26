// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_3748  (ROM 0x3748-0x37ce, The Pit) -- per-frame update dispatcher for an
 * object/actor. Gated on the alt-phase byte 0x807b and the phase byte 0x8010,
 * it either hands off to another handler or runs the movement/animation block
 * inline; every exit is a tail-jump, so the callee's ret returns to OUR caller.
 *
 * Dispatch (entry 0x3748-0x3766):
 *   - (0x807b) != 0            -> tail 0x37cf   (alt-phase handler)
 *   - phase (0x8010) >= 0x0a   -> tail 0x3a13
 *   - phase 0..2               -> movement block (loc_377e), inline
 *   - phase 3..5               -> loc_3767 (one-shot spawn) then the movement block
 *   - phase 6..8               -> tail 0x38c8
 *   - phase 9                  -> tail 0x3984
 *
 * loc_3767 (0x3767-0x377d): guarded by (0x8079). If it is 0, seed the object
 *   once -- step vector 0x810e/0x810f := 0x00ff (i.e. -1,0), mark (0x8079)=0xff
 *   spawned, and set the tile 0x8068 := 0x2d -- then fall through; else skip
 *   straight to the movement block. The `dec a` reuses A=0x00 -> 0xff.
 *
 * Movement block (loc_377e-loc_37cc): load the 16-bit step vector 0x810e/0x810f
 *   into HL (L=low, H=high). Tick the counter 0x8112 down; when it underflows to
 *   zero (`jr nz` NOT taken) reload it to 8 and toggle the tile code 0x810b
 *   between 0x2e and 0xaf, storing tile^1 to the sprite-shadow 0x811c. Then every
 *   4th tick ((0x8112) & 3 == 0): if X (0x810a) >= 0x11 advance X by L and mirror
 *   X+0x10 to 0x811b; if Y (0x810d) < 0x17 advance Y by H and mirror Y to 0x811e.
 *   Out-of-range X/Y and non-4th ticks fall to loc_37cc, which tail-jumps 0x3a4c.
 *
 * The `dec a` at 0x3789 sets the Z that `jr nz` (0x378d) reads -- the intervening
 * `ld (0x8112),a` writes memory and touches no flags, so it survives. All writes
 * land in work RAM, so none carries a hardware-write bus offset. Role is
 * best-effort from the code; addresses, flags, cycle costs and control flow are
 * exact, one JS statement per Z80 instruction.
 *
 * loc_3748:
 *   3748  3a 7b 80     ld   a,(0x807b)
 *   374b  b7           or   a
 *   374c  c2 cf 37     jp   nz,0x37cf
 *   374f  3a 10 80     ld   a,(0x8010)
 *   3752  fe 0a        cp   0x0a
 *   3754  d2 13 3a     jp   nc,0x3a13
 *   3757  fe 03        cp   0x03
 *   3759  38 23        jr   c,0x377e
 *   375b  fe 06        cp   0x06
 *   375d  38 08        jr   c,0x3767
 *   375f  fe 09        cp   0x09
 *   3761  da c8 38     jp   c,0x38c8
 *   3764  c3 84 39     jp   0x3984
 * loc_3767:
 *   3767  3a 79 80     ld   a,(0x8079)
 *   376a  a7           and  a
 *   376b  20 11        jr   nz,0x377e
 *   376d  3e 00        ld   a,0x00
 *   376f  32 0f 81     ld   (0x810f),a
 *   3772  3d           dec  a
 *   3773  32 0e 81     ld   (0x810e),a
 *   3776  32 79 80     ld   (0x8079),a
 *   3779  3e 2d        ld   a,0x2d
 *   377b  32 68 80     ld   (0x8068),a
 * loc_377e:
 *   377e  3a 0e 81     ld   a,(0x810e)
 *   3781  6f           ld   l,a
 *   3782  3a 0f 81     ld   a,(0x810f)
 *   3785  67           ld   h,a
 *   3786  3a 12 81     ld   a,(0x8112)
 *   3789  3d           dec  a
 *   378a  32 12 81     ld   (0x8112),a
 *   378d  20 18        jr   nz,0x37a7
 *   378f  3e 08        ld   a,0x08
 *   3791  32 12 81     ld   (0x8112),a
 *   3794  3a 0b 81     ld   a,(0x810b)
 *   3797  47           ld   b,a
 *   3798  3e 2e        ld   a,0x2e
 *   379a  b8           cp   b
 *   379b  20 02        jr   nz,0x379f
 *   379d  3e af        ld   a,0xaf
 * loc_379f:
 *   379f  32 0b 81     ld   (0x810b),a
 *   37a2  ee 01        xor  0x01
 *   37a4  32 1c 81     ld   (0x811c),a
 * loc_37a7:
 *   37a7  3a 12 81     ld   a,(0x8112)
 *   37aa  e6 03        and  0x03
 *   37ac  20 1e        jr   nz,0x37cc
 *   37ae  3a 0a 81     ld   a,(0x810a)
 *   37b1  fe 11        cp   0x11
 *   37b3  38 17        jr   c,0x37cc
 *   37b5  85           add  a,l
 *   37b6  32 0a 81     ld   (0x810a),a
 *   37b9  c6 10        add  a,0x10
 *   37bb  32 1b 81     ld   (0x811b),a
 *   37be  3a 0d 81     ld   a,(0x810d)
 *   37c1  fe 17        cp   0x17
 *   37c3  30 07        jr   nc,0x37cc
 *   37c5  84           add  a,h
 *   37c6  32 0d 81     ld   (0x810d),a
 *   37c9  32 1e 81     ld   (0x811e),a
 * loc_37cc:
 *   37cc  c3 4c 3a     jp   0x3a4c
 *
 * MODELLING NOTE. The loc_* labels above are basic blocks of ONE routine --
 * none is referenced from outside 0x3748-0x37ce -- reached only by internal
 * jumps and fall-through. They are driven by a label-dispatch loop (`next` holds
 * the ROM address of the block to run), exactly as loc_03e8. The loop charges NO
 * T-states; only m.step does. Conditional costs follow the Z80: jr taken 12 / not
 * 7; jp cc 10 either way. Every exit is a tail-jump: `m.step(target,10); return
 * m.call(target)` -- no push, no ret, since a `jp` leaves no return address.
 */
export function loc_3748(m) {
  const { regs, mem } = m;

  let next = 0x3748;
  for (;;) {
    switch (next) {
      case 0x3748: {
        regs.a = mem.read8(0x807b); m.step(0x374b, 13); // 3748  ld a,(0x807b)
        regs.or(regs.a); m.step(0x374c, 4); // 374b  or a
        if (regs.fNZ) { m.step(0x37cf, 10); return m.call(0x37cf); } // 374c  jp nz,0x37cf (taken -> tail out)
        m.step(0x374f, 10); // 374c  jp nz,0x37cf (not taken)
        regs.a = mem.read8(0x8010); m.step(0x3752, 13); // 374f  ld a,(0x8010)
        regs.cp(0x0a); m.step(0x3754, 7); // 3752  cp 0x0a
        if (regs.fNC) { m.step(0x3a13, 10); return m.call(0x3a13); } // 3754  jp nc,0x3a13 (taken -> tail out)
        m.step(0x3757, 10); // 3754  jp nc,0x3a13 (not taken)
        regs.cp(0x03); m.step(0x3759, 7); // 3757  cp 0x03
        if (regs.fC) { m.step(0x377e, 12); next = 0x377e; break; } // 3759  jr c,0x377e (taken)
        m.step(0x375b, 7); // 3759  jr c,0x377e (not taken)
        regs.cp(0x06); m.step(0x375d, 7); // 375b  cp 0x06
        if (regs.fC) { m.step(0x3767, 12); next = 0x3767; break; } // 375d  jr c,0x3767 (taken)
        m.step(0x375f, 7); // 375d  jr c,0x3767 (not taken)
        regs.cp(0x09); m.step(0x3761, 7); // 375f  cp 0x09
        if (regs.fC) { m.step(0x38c8, 10); return m.call(0x38c8); } // 3761  jp c,0x38c8 (taken -> tail out)
        m.step(0x3764, 10); // 3761  jp c,0x38c8 (not taken)
        m.step(0x3984, 10); return m.call(0x3984); // 3764  jp 0x3984 (tail out)
      }
      case 0x3767: {
        regs.a = mem.read8(0x8079); m.step(0x376a, 13); // 3767  ld a,(0x8079)
        regs.and(regs.a); m.step(0x376b, 4); // 376a  and a
        if (regs.fNZ) { m.step(0x377e, 12); next = 0x377e; break; } // 376b  jr nz,0x377e (taken -- already spawned)
        m.step(0x376d, 7); // 376b  jr nz,0x377e (not taken)
        regs.a = 0x00; m.step(0x376f, 7); // 376d  ld a,0x00
        mem.write8(0x810f, regs.a); m.step(0x3772, 13); // 376f  ld (0x810f),a -- step vector high := 0x00
        regs.a = regs.dec8(regs.a); m.step(0x3773, 4); // 3772  dec a -- A: 0x00 -> 0xff
        mem.write8(0x810e, regs.a); m.step(0x3776, 13); // 3773  ld (0x810e),a -- step vector low := 0xff
        mem.write8(0x8079, regs.a); m.step(0x3779, 13); // 3776  ld (0x8079),a -- mark spawned (0xff)
        regs.a = 0x2d; m.step(0x377b, 7); // 3779  ld a,0x2d
        mem.write8(0x8068, regs.a); m.step(0x377e, 13); // 377b  ld (0x8068),a -- initial tile
        next = 0x377e; break; // fall through to loc_377e
      }
      case 0x377e: {
        regs.a = mem.read8(0x810e); m.step(0x3781, 13); // 377e  ld a,(0x810e)
        regs.l = regs.a; m.step(0x3782, 4); // 3781  ld l,a -- step low
        regs.a = mem.read8(0x810f); m.step(0x3785, 13); // 3782  ld a,(0x810f)
        regs.h = regs.a; m.step(0x3786, 4); // 3785  ld h,a -- step high; HL = step vector
        regs.a = mem.read8(0x8112); m.step(0x3789, 13); // 3786  ld a,(0x8112)
        regs.a = regs.dec8(regs.a); m.step(0x378a, 4); // 3789  dec a -- sets Z read at 0x378d
        mem.write8(0x8112, regs.a); m.step(0x378d, 13); // 378a  ld (0x8112),a -- store; flags survive
        if (regs.fNZ) { m.step(0x37a7, 12); next = 0x37a7; break; } // 378d  jr nz,0x37a7 (still counting)
        m.step(0x378f, 7); // 378d  jr nz,0x37a7 (not taken -- underflowed)
        regs.a = 0x08; m.step(0x3791, 7); // 378f  ld a,0x08
        mem.write8(0x8112, regs.a); m.step(0x3794, 13); // 3791  ld (0x8112),a -- reload counter
        regs.a = mem.read8(0x810b); m.step(0x3797, 13); // 3794  ld a,(0x810b)
        regs.b = regs.a; m.step(0x3798, 4); // 3797  ld b,a -- current tile
        regs.a = 0x2e; m.step(0x379a, 7); // 3798  ld a,0x2e
        regs.cp(regs.b); m.step(0x379b, 4); // 379a  cp b -- tile == 0x2e ?
        if (regs.fNZ) { m.step(0x379f, 12); next = 0x379f; break; } // 379b  jr nz,0x379f (keep A=0x2e)
        m.step(0x379d, 7); // 379b  jr nz,0x379f (not taken -- was 0x2e)
        regs.a = 0xaf; m.step(0x379f, 7); // 379d  ld a,0xaf -- toggle to 0xaf
        next = 0x379f; break; // fall through to loc_379f
      }
      case 0x379f: {
        mem.write8(0x810b, regs.a); m.step(0x37a2, 13); // 379f  ld (0x810b),a -- new tile
        regs.xor(0x01); m.step(0x37a4, 7); // 37a2  xor 0x01 -- tile ^ 1
        mem.write8(0x811c, regs.a); m.step(0x37a7, 13); // 37a4  ld (0x811c),a -- sprite-shadow tile
        next = 0x37a7; break; // fall through to loc_37a7
      }
      case 0x37a7: {
        regs.a = mem.read8(0x8112); m.step(0x37aa, 13); // 37a7  ld a,(0x8112)
        regs.and(0x03); m.step(0x37ac, 7); // 37aa  and 0x03 -- every-4th-tick gate
        if (regs.fNZ) { m.step(0x37cc, 12); next = 0x37cc; break; } // 37ac  jr nz,0x37cc (not a 4th tick)
        m.step(0x37ae, 7); // 37ac  jr nz,0x37cc (not taken)
        regs.a = mem.read8(0x810a); m.step(0x37b1, 13); // 37ae  ld a,(0x810a) -- X
        regs.cp(0x11); m.step(0x37b3, 7); // 37b1  cp 0x11
        if (regs.fC) { m.step(0x37cc, 12); next = 0x37cc; break; } // 37b3  jr c,0x37cc (X < 0x11, no advance)
        m.step(0x37b5, 7); // 37b3  jr c,0x37cc (not taken)
        regs.add(regs.l); m.step(0x37b6, 4); // 37b5  add a,l -- advance X by step low
        mem.write8(0x810a, regs.a); m.step(0x37b9, 13); // 37b6  ld (0x810a),a
        regs.add(0x10); m.step(0x37bb, 7); // 37b9  add a,0x10
        mem.write8(0x811b, regs.a); m.step(0x37be, 13); // 37bb  ld (0x811b),a -- sprite-shadow X
        regs.a = mem.read8(0x810d); m.step(0x37c1, 13); // 37be  ld a,(0x810d) -- Y
        regs.cp(0x17); m.step(0x37c3, 7); // 37c1  cp 0x17
        if (regs.fNC) { m.step(0x37cc, 12); next = 0x37cc; break; } // 37c3  jr nc,0x37cc (Y >= 0x17, no advance)
        m.step(0x37c5, 7); // 37c3  jr nc,0x37cc (not taken)
        regs.add(regs.h); m.step(0x37c6, 4); // 37c5  add a,h -- advance Y by step high
        mem.write8(0x810d, regs.a); m.step(0x37c9, 13); // 37c6  ld (0x810d),a
        mem.write8(0x811e, regs.a); m.step(0x37cc, 13); // 37c9  ld (0x811e),a -- sprite-shadow Y
        next = 0x37cc; break; // fall through to loc_37cc
      }
      case 0x37cc: {
        m.step(0x3a4c, 10); return m.call(0x3a4c); // 37cc  jp 0x3a4c (tail out)
      }
      default:
        throw new Error(
          "loc_3748: dispatch to non-block address 0x" + next.toString(16),
        );
    }
  }
}
