// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_3968  (ROM 0x3968-0x3983, The Pit) -- per-frame position stepper for an
 * actor, a sibling of loc_384a's loc_38bc X-advance block: gated to every 4th
 * tick, it pulls the actor's coordinate 0x810a DOWN by one once it has reached
 * 0xc1 and mirrors the new value+0x10 to the sprite-shadow 0x811b. Reached by
 * fall-through / jr from loc_3945 (the timer tick). Every exit is a tail-jump to
 * 0x3a4c (the callee's ret returns to OUR caller); there is no `ret` of its own.
 *
 * Behaviour:
 *   - Read the animation timer 0x8112, mask its low two bits (and 0x03). If any
 *     are set this is not a 4th tick -> tail out to 0x3a4c, doing nothing.
 *   - On a 4th tick read the coordinate 0x810a and `cp 0xc1`. If it is below 0xc1
 *     (carry) -> tail out unchanged; the actor has not yet reached the limit.
 *   - Once 0x810a >= 0xc1: decrement it, store it back, then A += 0x10 and store
 *     that to the sprite-shadow 0x811b (logical coord + 0x10). Tail out to 0x3a4c.
 *
 * Flag chains preserved exactly: `and 0x03` (0x396b) sets the Z that `jp nz`
 * (0x396d) reads immediately; `cp 0xc1` (0x3973) sets the carry that `jp c`
 * (0x3975) reads immediately -- cp leaves A intact, so the `dec a` on the taken-
 * through path still operates on the coordinate. Both stores land in work RAM
 * (0x810a / 0x811b, both < 0x8800), so neither carries a hardware-write bus
 * offset. Role is best-effort; addresses, flags, cycle costs and control flow are
 * exact, one JS statement per Z80 instruction.
 *
 * loc_3968:
 *   3968  3a 12 81     ld   a,(0x8112)
 *   396b  e6 03        and  0x03
 *   396d  c2 4c 3a     jp   nz,0x3a4c
 *   3970  3a 0a 81     ld   a,(0x810a)
 *   3973  fe c1        cp   0xc1
 *   3975  da 4c 3a     jp   c,0x3a4c
 *   3978  3d           dec  a
 *   3979  32 0a 81     ld   (0x810a),a
 *   397c  c6 10        add  a,0x10
 *   397e  32 1b 81     ld   (0x811b),a
 *   3981  c3 4c 3a     jp   0x3a4c
 *
 * MODELLING NOTE. A single basic block: the only transfers of control leave the
 * routine (all to 0x3a4c), so there is no internal dispatch loop -- it reads
 * straight-line. `jp cc,nn` costs 10 T whether taken or not; when taken it is a
 * TAIL-jump (`m.step(0x3a4c,10); return m.call(0x3a4c)`, no push, no ret, since a
 * `jp` leaves no return address), and when not taken it steps to the fall-through
 * instruction for the same 10 T. `ld a,(nn)` and `ld (nn),a` are 13 T; `and n`,
 * `cp n` and `add a,n` are 7 T; `dec a` is 4 T.
 */
export function loc_3968(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8112); m.step(0x396b, 13); // 3968  ld a,(0x8112) -- animation timer
  regs.and(0x03); m.step(0x396d, 7); // 396b  and 0x03 -- every-4th-tick gate (sets Z read at 0x396d)
  if (regs.fNZ) { m.step(0x3a4c, 10); return m.call(0x3a4c); } // 396d  jp nz,0x3a4c (not a 4th tick -> tail out)
  m.step(0x3970, 10); // 396d  jp nz,0x3a4c (not taken)
  regs.a = mem.read8(0x810a); m.step(0x3973, 13); // 3970  ld a,(0x810a) -- coordinate
  regs.cp(0xc1); m.step(0x3975, 7); // 3973  cp 0xc1 -- sets carry if coord < 0xc1 (A intact)
  if (regs.fC) { m.step(0x3a4c, 10); return m.call(0x3a4c); } // 3975  jp c,0x3a4c (coord < 0xc1 -> tail out)
  m.step(0x3978, 10); // 3975  jp c,0x3a4c (not taken -- coord >= 0xc1)
  regs.a = regs.dec8(regs.a); m.step(0x3979, 4); // 3978  dec a -- coord - 1
  mem.write8(0x810a, regs.a); m.step(0x397c, 13); // 3979  ld (0x810a),a -- store coordinate
  regs.add(0x10); m.step(0x397e, 7); // 397c  add a,0x10 -- coord + 0x10 (sprite offset)
  mem.write8(0x811b, regs.a); m.step(0x3981, 13); // 397e  ld (0x811b),a -- sprite-shadow
  m.step(0x3a4c, 10); return m.call(0x3a4c); // 3981  jp 0x3a4c (tail out)
}
