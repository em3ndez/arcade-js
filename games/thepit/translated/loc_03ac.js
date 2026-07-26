// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_03ac  (ROM 0x03ac-0x03bb, The Pit) -- a reset/entry EPILOGUE reached both by
 * fall-through and by two forward `jr`s from loc_0371 (0x037d, 0x03a0). It clears
 * the player-number byte 0x8001 = 0, arms 0x8002 = 1, runs the 0x4b55 DSW decode and
 * the 0x3a6f setup call, then tail-jumps into the 0x01f9 reset/entry handler.
 *
 * Stores, in order:
 *   0x8001 = 0x00  -- clear the active player number (loc_0371 branched on it)
 *   0x8002 = 0x01  -- armed to 1 (A = inc'd from 0)
 * then:
 *   call 0x4b55    -- decode DSW
 *   call 0x3a6f    -- setup
 *   jp   0x01f9    -- unconditional tail-jump to the reset/entry handler
 *
 * MODELLING NOTE. Straight-line (no branches, no internal labels). Two unconditional
 * `call`s (0x4b55, 0x3a6f) each push their return + charge 17 T. The closing
 * `jp 0x01f9` is a tail-jump: advance PC + charge jp's 10 T, then `return m.call(0x01f9)`
 * with NO trailing m.ret -- loc_01f9's eventual `ret` returns to loc_03ac's caller (a
 * second ret would double-pop). loc_03ac has no `ld sp` of its own.
 *
 * Whole-routine T-state total = 7 + 13 + 4 + 13 + 17 + 17 + 10 = 81 T.
 *
 * NOTE: loc_03ac is a real label the disassembler emits, and loc_0371 currently
 * *inlines* these same bytes (its case 0x03ac) because it falls through / jumps here.
 * Per doc 03 (an externally-entered address is a routine boundary), this file is the
 * sole implementation; loc_0371 should be trimmed to `return m.call(0x03ac)` in a
 * separate pass so the two copies cannot drift. (Out of scope here; not edited.)
 *
 * Role is best-effort from the code; the addresses, flags, cycle costs and control
 * flow are exact, one JS statement per Z80 instruction.
 *
 * loc_03ac:
 *   03ac  3e 00        ld   a,0x00
 *   03ae  32 01 80     ld   (0x8001),a
 *   03b1  3c           inc  a
 *   03b2  32 02 80     ld   (0x8002),a
 *   03b5  cd 55 4b     call 0x4b55
 *   03b8  cd 6f 3a     call 0x3a6f
 *   03bb  c3 f9 01     jp   0x01f9
 */
export function loc_03ac(m) {
  const { regs, mem } = m;

  regs.a = 0x00; m.step(0x03ae, 7); // 03ac  ld a,0x00
  mem.write8(0x8001, regs.a); m.step(0x03b1, 13); // 03ae  ld (0x8001),a -- clear player number
  regs.a = regs.inc8(regs.a); m.step(0x03b2, 4); // 03b1  inc a -- A = 1
  mem.write8(0x8002, regs.a); m.step(0x03b5, 13); // 03b2  ld (0x8002),a -- arm 0x8002 = 1
  m.push16(0x03b8); m.step(0x4b55, 17); m.call(0x4b55); // 03b5  call 0x4b55 -- decode DSW
  m.push16(0x03bb); m.step(0x3a6f, 17); m.call(0x3a6f); // 03b8  call 0x3a6f -- setup

  // 03bb  jp 0x01f9 -- unconditional tail-jump to the 0x01f9 reset/entry handler.
  // No trailing m.ret: loc_01f9's eventual ret returns to loc_03ac's caller.
  m.step(0x01f9, 10);
  return m.call(0x01f9);
}
