// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_03be  (ROM 0x03be-0x03e7, The Pit) -- a play/state ENTRY reached by a jump:
 * it arms game-mode 4 and seeds the per-round gameplay counters, runs two setup
 * calls (0x4c47, then the 0x4b55 DSW decode), then tail-jumps into loc_031a (the
 * round/play (re)init that falls through into the main game loop at loc_0348).
 *
 * Stores, in order:
 *   0x8001 = 0x04  -- game-mode byte. loc_0348's main loop runs 0x03e8 only while
 *                     (0x8001) == 4, so this is the store that ENTERS play mode.
 *   0x801b = 0x01
 *   0x8002 = 0x01  -- armed to 1 (same A still holding 0x01)
 *   0x8029 = 0x03
 *   0x804e = 0x0c  -- base for loc_031a's delay derivation (0x8011 = 0x804e-0x8028)
 *   0x800b = 0x01  -- the 0x03e8 phase countdown's initial value
 *   0x800c = 0x00  -- the 0x03e8 phase index, reset to 0
 *
 * MODELLING NOTE. Straight-line (no branches, no labels). Two unconditional
 * `call`s (0x4c47, 0x4b55) each push their return + charge 17 T. The closing
 * `jp 0x031a` is a tail-jump: advance PC + charge jp's 10 T, then
 * `return m.call(0x031a)` with NO trailing m.ret -- loc_031a's eventual `ret`
 * returns to loc_03be's caller (a second ret would double-pop). loc_03be has no
 * `ld sp` of its own; the target loc_031a falls through into loc_0348, which
 * re-seats SP and loops forever.
 *
 * Role is best-effort from the code; the addresses, flags, cycle costs and control
 * flow are exact, one JS statement per Z80 instruction.
 *
 * loc_03be:
 *   03be  3e 04        ld   a,0x04
 *   03c0  32 01 80     ld   (0x8001),a
 *   03c3  3e 01        ld   a,0x01
 *   03c5  32 1b 80     ld   (0x801b),a
 *   03c8  32 02 80     ld   (0x8002),a
 *   03cb  3e 03        ld   a,0x03
 *   03cd  32 29 80     ld   (0x8029),a
 *   03d0  cd 47 4c     call 0x4c47
 *   03d3  cd 55 4b     call 0x4b55
 *   03d6  3e 0c        ld   a,0x0c
 *   03d8  32 4e 80     ld   (0x804e),a
 *   03db  3e 01        ld   a,0x01
 *   03dd  32 0b 80     ld   (0x800b),a
 *   03e0  3e 00        ld   a,0x00
 *   03e2  32 0c 80     ld   (0x800c),a
 *   03e5  c3 1a 03     jp   0x031a
 */
export function loc_03be(m) {
  const { regs, mem } = m;

  regs.a = 0x04; m.step(0x03c0, 7); // 03be  ld a,0x04
  mem.write8(0x8001, regs.a); m.step(0x03c3, 13); // 03c0  ld (0x8001),a -- enter game-mode 4
  regs.a = 0x01; m.step(0x03c5, 7); // 03c3  ld a,0x01
  mem.write8(0x801b, regs.a); m.step(0x03c8, 13); // 03c5  ld (0x801b),a
  mem.write8(0x8002, regs.a); m.step(0x03cb, 13); // 03c8  ld (0x8002),a -- arm 0x8002 = 1
  regs.a = 0x03; m.step(0x03cd, 7); // 03cb  ld a,0x03
  mem.write8(0x8029, regs.a); m.step(0x03d0, 13); // 03cd  ld (0x8029),a
  m.push16(0x03d3); m.step(0x4c47, 17); m.call(0x4c47); // 03d0  call 0x4c47
  m.push16(0x03d6); m.step(0x4b55, 17); m.call(0x4b55); // 03d3  call 0x4b55 -- decode DSW
  regs.a = 0x0c; m.step(0x03d8, 7); // 03d6  ld a,0x0c
  mem.write8(0x804e, regs.a); m.step(0x03db, 13); // 03d8  ld (0x804e),a -- delay base
  regs.a = 0x01; m.step(0x03dd, 7); // 03db  ld a,0x01
  mem.write8(0x800b, regs.a); m.step(0x03e0, 13); // 03dd  ld (0x800b),a -- 0x03e8 phase countdown
  regs.a = 0x00; m.step(0x03e2, 7); // 03e0  ld a,0x00
  mem.write8(0x800c, regs.a); m.step(0x03e5, 13); // 03e2  ld (0x800c),a -- 0x03e8 phase index = 0

  // 03e5  jp 0x031a -- unconditional tail-jump into the round/play (re)init at
  // loc_031a (which falls through into the main game loop). No trailing m.ret:
  // loc_031a's eventual ret returns to loc_03be's caller.
  m.step(0x031a, 10);
  return m.call(0x031a);
}
