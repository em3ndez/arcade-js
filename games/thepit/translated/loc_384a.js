// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_384a  (ROM 0x384a-0x38c5, The Pit) -- per-frame animator/mover for an
 * actor, a sibling of loc_3748's movement block: it ticks the actor's timer,
 * cycles its tile, and once every 4th tick steps it along a Y-then-X path with
 * boundary handling. Every exit is a tail-jump to 0x3a4c (the callee's ret
 * returns to OUR caller), except one conditional `ret nz` that returns directly.
 *
 * Behaviour:
 *   - Tick the timer 0x8112 down. While it stays non-zero, skip the animation
 *     (jr nz -> loc_386b). When it underflows to 0, reload it to 8 and toggle the
 *     tile code 0x810b between 0x2e and 0xaf, storing tile^1 to the sprite-shadow
 *     0x811c (loc_3863).
 *   - loc_386b gates on (timer & 3): only every 4th tick moves; otherwise tail
 *     out to 0x3a4c. On a move tick, examine Y (0x810d):
 *       * Y < 0x17            -> loc_389a (Y limit / bottom handling)
 *       * Y >= 0x17 and X (0x810a) < 0x24 -> loc_38bc: advance X by 1, mirror
 *         X+0x10 to sprite-shadow 0x811b, tail out.
 *       * Y >= 0x17, X >= 0x24, Y != 0x17 -> loc_389a
 *       * Y >= 0x17, X >= 0x24, Y == 0x17 -> clear 0x8079 and the tile 0x8068,
 *         set 0x807d := 1, call 0x1b5b, re-read Y, fall into loc_389a.
 *   - loc_389a: with A = Y, if Y != 0 decrement it (loc_38b2: store Y-1 to 0x810d
 *     and mirror to 0x811e, tail out). If Y == 0, and (0x807c) != 0, `ret nz`
 *     directly; else arm 0x807c := 0x78, set tile 0x810b := 0x09 and its shadow
 *     0x811c := 0x09, tail out.
 *
 * Flag chains preserved exactly: `dec a` (0x384d) sets the Z that `jr nz` (0x3851)
 * reads across the intervening `ld (0x8112),a` (a store touches no flags); the
 * same holds for `cp b`/`jr nz` (0x385e/0x385f), `and 0x03`/`jp nz` (0x386e/0x3870),
 * `cp 0x17`/`jr c` (0x3876/0x3878), `cp 0x24`/`jr c` (0x387d/0x387f),
 * `cp 0x17`/`jr nz` (0x3884/0x3886), and the two `and a`/branch pairs at loc_389a.
 * All writes land in work RAM, so none carries a hardware-write bus offset.
 * Role is best-effort; addresses, flags, cycle costs and control flow are exact,
 * one JS statement per Z80 instruction.
 *
 * loc_384a:
 *   384a  3a 12 81     ld   a,(0x8112)
 *   384d  3d           dec  a
 *   384e  32 12 81     ld   (0x8112),a
 *   3851  20 18        jr   nz,0x386b
 *   3853  3e 08        ld   a,0x08
 *   3855  32 12 81     ld   (0x8112),a
 *   3858  3a 0b 81     ld   a,(0x810b)
 *   385b  47           ld   b,a
 *   385c  3e 2e        ld   a,0x2e
 *   385e  b8           cp   b
 *   385f  20 02        jr   nz,0x3863
 *   3861  3e af        ld   a,0xaf
 * loc_3863:
 *   3863  32 0b 81     ld   (0x810b),a
 *   3866  ee 01        xor  0x01
 *   3868  32 1c 81     ld   (0x811c),a
 * loc_386b:
 *   386b  3a 12 81     ld   a,(0x8112)
 *   386e  e6 03        and  0x03
 *   3870  c2 4c 3a     jp   nz,0x3a4c
 *   3873  3a 0d 81     ld   a,(0x810d)
 *   3876  fe 17        cp   0x17
 *   3878  38 20        jr   c,0x389a
 *   387a  3a 0a 81     ld   a,(0x810a)
 *   387d  fe 24        cp   0x24
 *   387f  38 3b        jr   c,0x38bc
 *   3881  3a 0d 81     ld   a,(0x810d)
 *   3884  fe 17        cp   0x17
 *   3886  20 12        jr   nz,0x389a
 *   3888  3e 00        ld   a,0x00
 *   388a  32 79 80     ld   (0x8079),a
 *   388d  32 68 80     ld   (0x8068),a
 *   3890  3c           inc  a
 *   3891  32 7d 80     ld   (0x807d),a
 *   3894  cd 5b 1b     call 0x1b5b
 *   3897  3a 0d 81     ld   a,(0x810d)
 * loc_389a:
 *   389a  a7           and  a
 *   389b  20 15        jr   nz,0x38b2
 *   389d  3a 7c 80     ld   a,(0x807c)
 *   38a0  a7           and  a
 *   38a1  c0           ret  nz
 *   38a2  3e 78        ld   a,0x78
 *   38a4  32 7c 80     ld   (0x807c),a
 *   38a7  3e 09        ld   a,0x09
 *   38a9  32 0b 81     ld   (0x810b),a
 *   38ac  32 1c 81     ld   (0x811c),a
 *   38af  c3 4c 3a     jp   0x3a4c
 * loc_38b2:
 *   38b2  3d           dec  a
 *   38b3  32 0d 81     ld   (0x810d),a
 *   38b6  32 1e 81     ld   (0x811e),a
 *   38b9  c3 4c 3a     jp   0x3a4c
 * loc_38bc:
 *   38bc  3c           inc  a
 *   38bd  32 0a 81     ld   (0x810a),a
 *   38c0  c6 10        add  a,0x10
 *   38c2  32 1b 81     ld   (0x811b),a
 *   38c5  c3 4c 3a     jp   0x3a4c
 *
 * MODELLING NOTE. The loc_* labels above are basic blocks of ONE routine --
 * none is referenced from outside 0x384a-0x38c5 -- reached only by internal jumps
 * and fall-through. They are driven by a label-dispatch loop (`next` holds the ROM
 * address of the block to run), exactly as loc_3748. The loop charges NO T-states;
 * only m.step does. Conditional costs follow the Z80: jr taken 12 / not 7; jp cc
 * 10 either way; ret cc taken 11 / not 5; call 17. The `jp 0x3a4c` exits are
 * tail-jumps -- `m.step(0x3a4c,10); return m.call(0x3a4c)`, no push, no ret, since a
 * `jp` leaves no return address. The `call 0x1b5b` DOES push its return (0x3897).
 */
export function loc_384a(m) {
  const { regs, mem } = m;

  let next = 0x384a;
  for (;;) {
    switch (next) {
      case 0x384a: {
        regs.a = mem.read8(0x8112); m.step(0x384d, 13); // 384a  ld a,(0x8112)
        regs.a = regs.dec8(regs.a); m.step(0x384e, 4); // 384d  dec a -- sets Z read at 0x3851
        mem.write8(0x8112, regs.a); m.step(0x3851, 13); // 384e  ld (0x8112),a -- store; flags survive
        if (regs.fNZ) { m.step(0x386b, 12); next = 0x386b; break; } // 3851  jr nz,0x386b (still counting)
        m.step(0x3853, 7); // 3851  jr nz,0x386b (not taken -- underflowed)
        regs.a = 0x08; m.step(0x3855, 7); // 3853  ld a,0x08
        mem.write8(0x8112, regs.a); m.step(0x3858, 13); // 3855  ld (0x8112),a -- reload counter
        regs.a = mem.read8(0x810b); m.step(0x385b, 13); // 3858  ld a,(0x810b)
        regs.b = regs.a; m.step(0x385c, 4); // 385b  ld b,a -- current tile
        regs.a = 0x2e; m.step(0x385e, 7); // 385c  ld a,0x2e
        regs.cp(regs.b); m.step(0x385f, 4); // 385e  cp b -- tile == 0x2e ?
        if (regs.fNZ) { m.step(0x3863, 12); next = 0x3863; break; } // 385f  jr nz,0x3863 (keep A=0x2e)
        m.step(0x3861, 7); // 385f  jr nz,0x3863 (not taken -- was 0x2e)
        regs.a = 0xaf; m.step(0x3863, 7); // 3861  ld a,0xaf -- toggle to 0xaf
        next = 0x3863; break; // fall through to loc_3863
      }
      case 0x3863: {
        mem.write8(0x810b, regs.a); m.step(0x3866, 13); // 3863  ld (0x810b),a -- new tile
        regs.xor(0x01); m.step(0x3868, 7); // 3866  xor 0x01 -- tile ^ 1
        mem.write8(0x811c, regs.a); m.step(0x386b, 13); // 3868  ld (0x811c),a -- sprite-shadow tile
        next = 0x386b; break; // fall through to loc_386b
      }
      case 0x386b: {
        regs.a = mem.read8(0x8112); m.step(0x386e, 13); // 386b  ld a,(0x8112)
        regs.and(0x03); m.step(0x3870, 7); // 386e  and 0x03 -- every-4th-tick gate
        if (regs.fNZ) { m.step(0x3a4c, 10); return m.call(0x3a4c); } // 3870  jp nz,0x3a4c (not a 4th tick -> tail out)
        m.step(0x3873, 10); // 3870  jp nz,0x3a4c (not taken)
        regs.a = mem.read8(0x810d); m.step(0x3876, 13); // 3873  ld a,(0x810d) -- Y
        regs.cp(0x17); m.step(0x3878, 7); // 3876  cp 0x17
        if (regs.fC) { m.step(0x389a, 12); next = 0x389a; break; } // 3878  jr c,0x389a (Y < 0x17)
        m.step(0x387a, 7); // 3878  jr c,0x389a (not taken)
        regs.a = mem.read8(0x810a); m.step(0x387d, 13); // 387a  ld a,(0x810a) -- X
        regs.cp(0x24); m.step(0x387f, 7); // 387d  cp 0x24
        if (regs.fC) { m.step(0x38bc, 12); next = 0x38bc; break; } // 387f  jr c,0x38bc (X < 0x24 -> advance X)
        m.step(0x3881, 7); // 387f  jr c,0x38bc (not taken)
        regs.a = mem.read8(0x810d); m.step(0x3884, 13); // 3881  ld a,(0x810d) -- Y (re-read)
        regs.cp(0x17); m.step(0x3886, 7); // 3884  cp 0x17
        if (regs.fNZ) { m.step(0x389a, 12); next = 0x389a; break; } // 3886  jr nz,0x389a (Y != 0x17)
        m.step(0x3888, 7); // 3886  jr nz,0x389a (not taken -- Y == 0x17)
        regs.a = 0x00; m.step(0x388a, 7); // 3888  ld a,0x00
        mem.write8(0x8079, regs.a); m.step(0x388d, 13); // 388a  ld (0x8079),a -- clear
        mem.write8(0x8068, regs.a); m.step(0x3890, 13); // 388d  ld (0x8068),a -- clear tile
        regs.a = regs.inc8(regs.a); m.step(0x3891, 4); // 3890  inc a -- A: 0x00 -> 0x01
        mem.write8(0x807d, regs.a); m.step(0x3894, 13); // 3891  ld (0x807d),a -- set flag
        m.push16(0x3897); m.step(0x1b5b, 17); m.call(0x1b5b); // 3894  call 0x1b5b (returns to 0x3897)
        regs.a = mem.read8(0x810d); m.step(0x389a, 13); // 3897  ld a,(0x810d) -- reload Y
        next = 0x389a; break; // fall through to loc_389a
      }
      case 0x389a: {
        regs.and(regs.a); m.step(0x389b, 4); // 389a  and a -- Y == 0 ?
        if (regs.fNZ) { m.step(0x38b2, 12); next = 0x38b2; break; } // 389b  jr nz,0x38b2 (Y != 0 -> decrement it)
        m.step(0x389d, 7); // 389b  jr nz,0x38b2 (not taken -- Y == 0)
        regs.a = mem.read8(0x807c); m.step(0x38a0, 13); // 389d  ld a,(0x807c)
        regs.and(regs.a); m.step(0x38a1, 4); // 38a0  and a -- (0x807c) == 0 ?
        if (regs.fNZ) { return m.ret(11); } // 38a1  ret nz (taken -- 0x807c busy)
        m.step(0x38a2, 5); // 38a1  ret nz (not taken)
        regs.a = 0x78; m.step(0x38a4, 7); // 38a2  ld a,0x78
        mem.write8(0x807c, regs.a); m.step(0x38a7, 13); // 38a4  ld (0x807c),a -- arm timer
        regs.a = 0x09; m.step(0x38a9, 7); // 38a7  ld a,0x09
        mem.write8(0x810b, regs.a); m.step(0x38ac, 13); // 38a9  ld (0x810b),a -- tile := 0x09
        mem.write8(0x811c, regs.a); m.step(0x38af, 13); // 38ac  ld (0x811c),a -- shadow := 0x09
        m.step(0x3a4c, 10); return m.call(0x3a4c); // 38af  jp 0x3a4c (tail out)
      }
      case 0x38b2: {
        regs.a = regs.dec8(regs.a); m.step(0x38b3, 4); // 38b2  dec a -- Y - 1
        mem.write8(0x810d, regs.a); m.step(0x38b6, 13); // 38b3  ld (0x810d),a -- store Y
        mem.write8(0x811e, regs.a); m.step(0x38b9, 13); // 38b6  ld (0x811e),a -- sprite-shadow Y
        m.step(0x3a4c, 10); return m.call(0x3a4c); // 38b9  jp 0x3a4c (tail out)
      }
      case 0x38bc: {
        regs.a = regs.inc8(regs.a); m.step(0x38bd, 4); // 38bc  inc a -- X + 1
        mem.write8(0x810a, regs.a); m.step(0x38c0, 13); // 38bd  ld (0x810a),a -- store X
        regs.add(0x10); m.step(0x38c2, 7); // 38c0  add a,0x10
        mem.write8(0x811b, regs.a); m.step(0x38c5, 13); // 38c2  ld (0x811b),a -- sprite-shadow X
        m.step(0x3a4c, 10); return m.call(0x3a4c); // 38c5  jp 0x3a4c (tail out)
      }
      default:
        throw new Error(
          "loc_384a: dispatch to non-block address 0x" + next.toString(16),
        );
    }
  }
}
