// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1c4f  (ROM 0x1C4F–0x1C75) — reset to state 0, arm the 0x621E lock, sound frontier.
 */
export function loc_1c4f(m) {
  const { regs, mem } = m;
  mem.write8(0x6216, regs.a); // A = 0 (from the dec b path)
  m.step(0x1c52, 13); // ld (0x6216),a
  regs.a = mem.read8(0x6220);
  m.step(0x1c55, 13); // ld a,(0x6220)
  regs.xor(0x01);
  m.step(0x1c57, 7); // xor 0x01
  mem.write8(0x6200, regs.a);
  m.step(0x1c5a, 13); // ld (0x6200),a
  regs.hl = 0x6207;
  m.step(0x1c5d, 10); // ld hl,0x6207
  regs.a = mem.read8(regs.hl);
  m.step(0x1c5e, 7); // ld a,(hl)
  regs.and(0x80);
  m.step(0x1c60, 7); // and 0x80
  regs.or(0x0f);
  m.step(0x1c62, 7); // or 0x0f
  mem.write8(regs.hl, regs.a);
  m.step(0x1c63, 7); // ld (hl),a
  regs.a = 0x04;
  m.step(0x1c65, 7); // ld a,0x04
  mem.write8(0x621e, regs.a); // arm the lock (loc_1b55 counts it down)
  m.step(0x1c68, 13); // ld (0x621e),a
  regs.xor(regs.a);
  m.step(0x1c69, 4); // xor a
  mem.write8(0x621f, regs.a);
  m.step(0x1c6c, 13); // ld (0x621f),a
  regs.a = mem.read8(0x6225);
  m.step(0x1c6f, 13); // ld a,(0x6225)
  regs.a = regs.dec8(regs.a);
  m.step(0x1c70, 4); // dec a
  if (regs.fZ) {
    m.push16(0x1c73); // call z,0x1d95 taken -- pushes return address
    m.step(0x1d95, 17);
    m.call(0x1d95);
  } else {
    m.step(0x1c73, 10); // call z NOT taken
  }
  m.step(0x1da6, 10); // jp 0x1da6
  return m.call(0x1da6);
}
