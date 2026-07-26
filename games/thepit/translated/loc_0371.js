// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0371  (ROM 0x0371-0x03bb, The Pit) -- a state ENTRY reached by a jump: it
 * re-establishes SP = 0x83ff (so the caller's return frame is discarded), then
 * runs per-player end-of-round teardown for the active player number held at
 * 0x8001 -- but ONLY when that number is 1 or 2. Finally it clears 0x8001,
 * arms 0x8002 = 1, decodes the DSW (0x4b55), calls 0x3a6f, and tail-jumps to
 * the 0x01f9 reset/entry handler.
 *
 * Flow:
 *   - 0x0371-0x037d  reset SP, call 0x4c63, load the player number (0x8001),
 *     `dec a` then `cp 0x02`. The `jr nc,0x03ac` at 0x037d skips the whole
 *     teardown unless (0x8001)-1 < 2 -- i.e. unless (0x8001) is 1 or 2. (For a
 *     player number of 1 or 2, dec gives 0 or 1, cp 0x02 borrows -> NC false ->
 *     fall into the teardown; any other value takes the branch.)
 *   - 0x037f-0x0395  player-1 teardown: call 0x4b46 with A=0xe0, call 0x4bff
 *     with A=0x14, arm 0x8002 = 1, call 0x4cbf, and -- only if (0x8048) != 0 --
 *     call 0x4df8.
 *   - 0x0398-0x03a0  reload the player number into 0x8002, then `cp 0x02`; the
 *     `jr nz,0x03ac` skips the second teardown pass unless (0x8001) == 2.
 *   - 0x03a2-0x03a9  player-2 second pass: call 0x4cbf, then call 0x4df8 iff
 *     (0x8048) != 0.
 *   - loc_03ac (0x03ac-0x03bb)  clear 0x8001 = 0, set 0x8002 = 1, call 0x4b55
 *     (DSW decode) and 0x3a6f, then `jp 0x01f9` -- an unconditional tail-jump.
 *
 * Role is best-effort from the code; the addresses, flags, cycle costs and
 * control flow are exact, one JS statement per Z80 instruction.
 *
 * MODELLING NOTE. loc_03ac is a real label in the disassembly, reached both by
 * fall-through and by the two forward `jr`s (0x037d and 0x03a0). As in loc_03e8,
 * the routine's basic blocks are driven by a label-dispatch loop: `next` holds
 * the ROM address of the block to run; a block either sets `next` and `break`s,
 * or exits the function. The loop charges NO T-states -- only m.step does.
 * Conditional-branch costs follow the Z80: jr taken 12 / not 7, call cc taken
 * 17 / not 10, jp 10. The closing `jp 0x01f9` is a tail-jump: advance PC + charge
 * jp's 10 T, then `return m.call(0x01f9)` with NO trailing m.ret -- the target's
 * eventual `ret` returns to loc_0371's caller (a second ret would double-pop).
 *
 * loc_0371:
 *   0371  31 ff 83     ld   sp,0x83ff
 *   0374  cd 63 4c     call 0x4c63
 *   0377  3a 01 80     ld   a,(0x8001)
 *   037a  3d           dec  a
 *   037b  fe 02        cp   0x02
 *   037d  30 2d        jr   nc,0x03ac
 *   037f  3e e0        ld   a,0xe0
 *   0381  cd 46 4b     call 0x4b46
 *   0384  3e 14        ld   a,0x14
 *   0386  cd ff 4b     call 0x4bff
 *   0389  3e 01        ld   a,0x01
 *   038b  32 02 80     ld   (0x8002),a
 *   038e  cd bf 4c     call 0x4cbf
 *   0391  3a 48 80     ld   a,(0x8048)
 *   0394  b7           or   a
 *   0395  c4 f8 4d     call nz,0x4df8
 *   0398  3a 01 80     ld   a,(0x8001)
 *   039b  32 02 80     ld   (0x8002),a
 *   039e  fe 02        cp   0x02
 *   03a0  20 0a        jr   nz,0x03ac
 *   03a2  cd bf 4c     call 0x4cbf
 *   03a5  3a 48 80     ld   a,(0x8048)
 *   03a8  b7           or   a
 *   03a9  c4 f8 4d     call nz,0x4df8
 * loc_03ac:
 *   03ac  3e 00        ld   a,0x00
 *   03ae  32 01 80     ld   (0x8001),a
 *   03b1  3c           inc  a
 *   03b2  32 02 80     ld   (0x8002),a
 *   03b5  cd 55 4b     call 0x4b55
 *   03b8  cd 6f 3a     call 0x3a6f
 *   03bb  c3 f9 01     jp   0x01f9
 */
export function loc_0371(m) {
  const { regs, mem } = m;

  // Label-dispatch loop over the routine's basic blocks (see header). `next` is
  // the ROM address of the block to run; a block sets `next` and breaks, or exits.
  let next = 0x0371;
  for (;;) {
    switch (next) {
      case 0x0371: {
        regs.sp = 0x83ff; m.step(0x0374, 10); // 0371  ld sp,0x83ff (state entry: reset stack)
        m.push16(0x0377); m.step(0x4c63, 17); m.call(0x4c63); // 0374  call 0x4c63
        regs.a = mem.read8(0x8001); m.step(0x037a, 13); // 0377  ld a,(0x8001) -- player number
        regs.a = regs.dec8(regs.a); m.step(0x037b, 4); // 037a  dec a
        regs.cp(0x02); m.step(0x037d, 7); // 037b  cp 0x02
        if (regs.fNC) { m.step(0x03ac, 12); next = 0x03ac; break; } // 037d  jr nc,0x03ac (taken: not player 1/2)
        m.step(0x037f, 7); // 037d  jr nc,0x03ac (not taken)
        regs.a = 0xe0; m.step(0x0381, 7); // 037f  ld a,0xe0
        m.push16(0x0384); m.step(0x4b46, 17); m.call(0x4b46); // 0381  call 0x4b46
        regs.a = 0x14; m.step(0x0386, 7); // 0384  ld a,0x14
        m.push16(0x0389); m.step(0x4bff, 17); m.call(0x4bff); // 0386  call 0x4bff
        regs.a = 0x01; m.step(0x038b, 7); // 0389  ld a,0x01
        mem.write8(0x8002, regs.a); m.step(0x038e, 13); // 038b  ld (0x8002),a
        m.push16(0x0391); m.step(0x4cbf, 17); m.call(0x4cbf); // 038e  call 0x4cbf
        regs.a = mem.read8(0x8048); m.step(0x0394, 13); // 0391  ld a,(0x8048)
        regs.or(regs.a); m.step(0x0395, 4); // 0394  or a -- Z <- (0x8048 == 0)
        if (regs.fNZ) { m.push16(0x0398); m.step(0x4df8, 17); m.call(0x4df8); } // 0395  call nz,0x4df8 (taken)
        else { m.step(0x0398, 10); } // 0395  call nz,0x4df8 (not taken)
        regs.a = mem.read8(0x8001); m.step(0x039b, 13); // 0398  ld a,(0x8001)
        mem.write8(0x8002, regs.a); m.step(0x039e, 13); // 039b  ld (0x8002),a
        regs.cp(0x02); m.step(0x03a0, 7); // 039e  cp 0x02
        if (regs.fNZ) { m.step(0x03ac, 12); next = 0x03ac; break; } // 03a0  jr nz,0x03ac (taken: not player 2)
        m.step(0x03a2, 7); // 03a0  jr nz,0x03ac (not taken)
        m.push16(0x03a5); m.step(0x4cbf, 17); m.call(0x4cbf); // 03a2  call 0x4cbf
        regs.a = mem.read8(0x8048); m.step(0x03a8, 13); // 03a5  ld a,(0x8048)
        regs.or(regs.a); m.step(0x03a9, 4); // 03a8  or a -- Z <- (0x8048 == 0)
        if (regs.fNZ) { m.push16(0x03ac); m.step(0x4df8, 17); m.call(0x4df8); } // 03a9  call nz,0x4df8 (taken)
        else { m.step(0x03ac, 10); } // 03a9  call nz,0x4df8 (not taken)
        next = 0x03ac; break; // fall through to loc_03ac
      }
      case 0x03ac: {
        regs.a = 0x00; m.step(0x03ae, 7); // 03ac  ld a,0x00
        mem.write8(0x8001, regs.a); m.step(0x03b1, 13); // 03ae  ld (0x8001),a -- clear player number
        regs.a = regs.inc8(regs.a); m.step(0x03b2, 4); // 03b1  inc a -- A = 1
        mem.write8(0x8002, regs.a); m.step(0x03b5, 13); // 03b2  ld (0x8002),a -- arm 0x8002 = 1
        m.push16(0x03b8); m.step(0x4b55, 17); m.call(0x4b55); // 03b5  call 0x4b55 -- decode DSW
        m.push16(0x03bb); m.step(0x3a6f, 17); m.call(0x3a6f); // 03b8  call 0x3a6f
        // 03bb  jp 0x01f9 -- unconditional tail-jump to the 0x01f9 reset/entry handler.
        m.step(0x01f9, 10);
        return m.call(0x01f9);
      }
      default:
        throw new Error(
          "loc_0371: dispatch to non-block address 0x" + next.toString(16),
        );
    }
  }
}
