// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0691  (ROM 0x0691–0x06A7) — The twin of loc_066a with INVERTED register
 * roles: the ORIGINAL goes to B, and the low nibble is left in A.
 *
 *   0691  3a 8c 63     ld   a,(0x638c)
 *   0694  47           ld   b,a          ; ORIGINAL in B, not C
 *   0695  e6 0f        and  0x0f         ; low nibble left in A, not moved
 *   0697  c5           push bc
 *   0698  cd 1c 05     call 0x051c
 *   069b  c1           pop  bc
 *   069c  78           ld   a,b
 *   069d  0f 0f 0f 0f  rrca x4
 *   06a1  e6 0f        and  0x0f
 *   06a3  c6 0a        add  a,0x0a
 *   06a5  c3 1c 05     jp   0x051c
 *
 * ENTERS entry_051c TWICE BY TWO DIFFERENT MECHANISMS, thirteen bytes apart:
 * a `call` at 0x0698 with a return address pushed, and a TAIL JUMP at 0x06A5
 * with nothing pushed. The tail jump means this block never reaches a `ret` of
 * its own -- entry_051c's `ret` returns to entry_062a's caller.
 *
 * C IS LIVE-IN HERE and is pushed at 0x0697 without ever being set. The `pop`
 * at 0x069B restores it, but the value handed to entry_051c on the FIRST call
 * is the caller's C, because `push` does not clear the register and the `call`
 * is the very next instruction.
 *
 * The second entry passes A = high nibble + 0x0A, i.e. the same routine is
 * invoked once per BCD digit with the second index offset by ten.
 */
export function loc_0691(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x638c);
  m.step(0x0694, 13); // ld a,(0x638c)
  regs.b = regs.a; // ORIGINAL in B -- loc_066a uses C
  m.step(0x0695, 4); // ld b,a
  regs.and(0x0f); // low nibble stays in A
  m.step(0x0697, 7); // and 0x0f

  m.push16(regs.bc); // C is the caller's -- never set on this path
  m.step(0x0698, 11); // push bc
  m.push16(0x069b);
  m.step(0x051c, 17); // call 0x051c
  m.call(0x051c);
  regs.bc = m.pop16();
  m.step(0x069c, 10); // pop bc

  regs.a = regs.b;
  m.step(0x069d, 4); // ld a,b
  for (const next of [0x069e, 0x069f, 0x06a0, 0x06a1]) {
    regs.rrca();
    m.step(next, 4); // rrca
  }
  regs.and(0x0f);
  m.step(0x06a3, 7); // and 0x0f
  regs.add(0x0a); // the second digit's table index is offset by ten
  m.step(0x06a5, 7); // add a,0x0a

  m.step(0x051c, 10); // jp 0x051c -- TAIL JUMP, nothing pushed
  return m.call(0x051c);
}
