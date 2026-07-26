// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_01f9  (ROM 0x01f9-0x0219, The Pit) — a game-state entry handler: resets
 * the stack, enables the NMI, decodes the DSW, then forks on the flag byte at
 * 0x8000.
 *
 *   01f9  31 ff 83     ld   sp,0x83ff
 *   01fc  cd 14 4b     call 0x4b14        ; enable NMI (LS259 b0)
 *   01ff  3e 01        ld   a,0x01
 *   0201  32 02 80     ld   (0x8002),a    ; 0x8002 <- 1
 *   0204  cd 55 4b     call 0x4b55        ; read+decode the DSW
 *   0207  3a 00 80     ld   a,(0x8000)
 *   020a  b7           or   a             ; test the flag at 0x8000
 *   020b  c2 1c 02     jp   nz,0x021c     ; nonzero -> tail-jump to 0x021c
 *   020e  cd 47 4c     call 0x4c47        ; disable sound (LS259 b3)
 *   0211  3e 00        ld   a,0x00
 *   0213  32 01 80     ld   (0x8001),a    ; 0x8001 <- 0
 *   0216  cd 81 3b     call 0x3b81        ; paint the fixed screen
 *   0219  c3 be 03     jp   0x03be        ; tail-jump to 0x03be
 *
 * Because it re-establishes SP = 0x83ff at entry, this is a state ENTRY point
 * reached by a jump, not a called subroutine — the caller's return frame is
 * discarded. Both exits are unconditional tail-jumps (into 0x021c or 0x03be),
 * so it never executes a `ret` of its own; whichever target it jumps to owns
 * the eventual return.
 *
 * The fork is on the byte at 0x8000: nonzero takes the 0x021c branch (which
 * sets 0x8001 = 3), zero takes the local arm that disables sound, clears
 * 0x8001 = 0, paints the fixed screen via 0x3b81, and hands off to 0x03be.
 * 0x8002 is armed to 1 before the fork, on both paths.
 *
 * Tail-jumps are modelled the DK/thepit way (see loc_0000): advance PC + charge
 * the 10 T of `jp`, then `return m.call(target)` so the target's control flow
 * propagates back through the JS stack — NOT `m.call(); m.ret()`, which would
 * push a spurious word and add a second ret's cycles.
 */
export function loc_01f9(m) {
  const { regs, mem } = m;

  regs.sp = 0x83ff;
  m.step(0x01fc, 10); // 01f9  ld sp,0x83ff

  m.push16(0x01ff);
  m.step(0x4b14, 17); // 01fc  call 0x4b14 -- enable NMI
  m.call(0x4b14);

  regs.a = 0x01;
  m.step(0x0201, 7); // 01ff  ld a,0x01

  mem.write8(0x8002, regs.a);
  m.step(0x0204, 13); // 0201  ld (0x8002),a

  m.push16(0x0207);
  m.step(0x4b55, 17); // 0204  call 0x4b55 -- decode DSW
  m.call(0x4b55);

  regs.a = mem.read8(0x8000);
  m.step(0x020a, 13); // 0207  ld a,(0x8000)

  regs.or(regs.a);
  m.step(0x020b, 4); // 020a  or a -- Z <- (0x8000 == 0)

  // 020b  jp nz,0x021c -- 0x8000 nonzero: tail-jump to the 0x021c state handler.
  // JP cc,nn is 10 T whether taken or not.
  if (regs.fNZ) {
    m.step(0x021c, 10);
    return m.call(0x021c);
  }
  m.step(0x020e, 10); // jp not taken -- fall through to the zero arm

  m.push16(0x0211);
  m.step(0x4c47, 17); // 020e  call 0x4c47 -- disable sound
  m.call(0x4c47);

  regs.a = 0x00;
  m.step(0x0213, 7); // 0211  ld a,0x00

  mem.write8(0x8001, regs.a);
  m.step(0x0216, 13); // 0213  ld (0x8001),a

  m.push16(0x0219);
  m.step(0x3b81, 17); // 0216  call 0x3b81 -- paint the fixed screen
  m.call(0x3b81);

  // 0219  jp 0x03be -- unconditional tail-jump to the 0x03be state handler.
  m.step(0x03be, 10);
  return m.call(0x03be);
}
