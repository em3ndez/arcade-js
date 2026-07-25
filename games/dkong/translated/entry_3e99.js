// SPDX-License-Identifier: GPL-3.0-only

/**
 * entry_3e99  (ROM 0x3E99–0x3EC2) — 42 bytes, 20 instructions.
 *
 *   3e99  e1           pop  hl            ; recover entry_3e88's pushed HL
 *   3e9a  af           xor  a
 *   3e9b  32 60 60     ld   (0x6060),a    ; clear the collision counter
 *   3e9e  06 0a        ld   b,0x0a
 *   3ea0  11 20 00     ld   de,0x0020
 *   3ea3  dd 21 00 67  ld   ix,0x6700
 *   3ea7  cd c3 3e     call 0x3ec3        ; count overlaps in group 1 (10 objects)
 *   3eaa  06 05        ld   b,0x05        ; entry_3eaa
 *   3eac  dd 21 00 64  ld   ix,0x6400
 *   3eb0  cd c3 3e     call 0x3ec3        ; count overlaps in group 2 (5 objects)
 *   3eb3  3a 60 60     ld   a,(0x6060)
 *   3eb6  a7           and  a
 *   3eb7  c8           ret  z             ; count 0 -> code 0
 *   3eb8  fe 01        cp   0x01
 *   3eba  c8           ret  z             ; count 1 -> code 1
 *   3ebb  fe 03        cp   0x03
 *   3ebd  3e 03        ld   a,0x03
 *   3ebf  d8           ret  c             ; count 2 (< 3) -> code 3
 *   3ec0  3e 07        ld   a,0x07
 *   3ec2  c9           ret                ; count >= 3 -> code 7
 *
 * Translated for completeness; not yet wired into the live dispatcher.
 * Not yet wired into the live dispatcher: reached ONLY via entry_3e88's rst 0x28 table
 * (entry 1), which is untranslated. Its two callees are both entry_3ec3
 * (drain #26). LIVE-INS: HL (off the stack), IY, C, H, L (the last four passed
 * through to entry_3ec3).
 *
 * THE PUSH/POP-ACROSS-DISPATCH SHAPE (this is why it is NOT the 30fa tail case).
 * entry_3e88 does `push hl` BEFORE its rst 0x28 precisely because sub_0028 clobbers
 * HL: sub_0028's own `pop hl` takes the table base into HL. entry_3e99's first
 * instruction, `pop hl`, RECOVERS entry_3e88's saved HL from beneath that. So
 * the pop is not decorative -- it restores a live-in that the dispatch mechanism
 * destroyed. Modelled `regs.hl = m.pop16()`.
 *
 * NOT skip-capable: no inc sp, all exits are ordinary `ret`. It returns a
 * collision-severity CODE in A (count 0/1/2/>=3 -> 0/1/3/7), not a boolean, so
 * when entry_3e88 lands its dispatchGameState arm is a plain `return
 * m.call(0x3e99)` like the game-state handlers. `cp 0x03` then `ld a,0x03` then
 * `ret c` reads the carry from the cp ACROSS the flag-neutral `ld` -- the value
 * 0x03 is loaded before the branch that decides whether to return it. 0x6060 /
 * the object fields not interpreted.
 */
export function entry_3e99(m) {
  const { regs, mem } = m;

  regs.hl = m.pop16(); // pop hl -- recover entry_3e88's saved HL (sub_0028 clobbered it)
  m.step(0x3e9a, 10); // pop hl
  regs.xor(regs.a); // xor a -- A = 0
  m.step(0x3e9b, 4); // xor a
  mem.write8(0x6060, regs.a);
  m.step(0x3e9e, 13); // ld (0x6060),a -- clear the counter
  regs.b = 0x0a;
  m.step(0x3ea0, 7); // ld b,0x0a
  regs.de = 0x0020;
  m.step(0x3ea3, 10); // ld de,0x0020
  regs.ix = 0x6700;
  m.step(0x3ea7, 14); // ld ix,0x6700

  m.push16(0x3eaa);
  m.step(0x3ec3, 17); // call 0x3ec3
  m.call(0x3ec3); // group 1; leaves 0x6060 = overlap count so far

  regs.b = 0x05;
  m.step(0x3eac, 7); // ld b,0x05
  regs.ix = 0x6400;
  m.step(0x3eb0, 14); // ld ix,0x6400 -- DE still 0x0020 from above

  m.push16(0x3eb3);
  m.step(0x3ec3, 17); // call 0x3ec3
  m.call(0x3ec3); // group 2; accumulates into the same 0x6060

  regs.a = mem.read8(0x6060);
  m.step(0x3eb6, 13); // ld a,(0x6060)
  regs.and(regs.a); // and a
  m.step(0x3eb7, 4); // and a
  if (regs.fZ) {
    m.ret(11); // ret z -- count 0 -> code 0
    return;
  }
  m.step(0x3eb8, 5); // ret z NOT taken
  regs.cp(0x01);
  m.step(0x3eba, 7); // cp 0x01
  if (regs.fZ) {
    m.ret(11); // ret z -- count 1 -> code 1
    return;
  }
  m.step(0x3ebb, 5); // ret z NOT taken
  regs.cp(0x03); // sets carry if count < 3
  m.step(0x3ebd, 7); // cp 0x03
  regs.a = 0x03; // flag-neutral -- carry from cp 0x03 survives
  m.step(0x3ebf, 7); // ld a,0x03
  if (regs.fC) {
    m.ret(11); // ret c -- count 2 (< 3) -> code 3
    return;
  }
  m.step(0x3ec0, 5); // ret c NOT taken
  regs.a = 0x07;
  m.step(0x3ec2, 7); // ld a,0x07
  m.ret(); // 3ec2 -- count >= 3 -> code 7
}
