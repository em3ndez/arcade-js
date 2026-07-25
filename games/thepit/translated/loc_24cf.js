// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_24cf  (ROM 0x24cf–0x24f2) — seeds a state/entity block in work RAM with
 * spawn-default constants, then tail-jumps to loc_287a.
 *
 *   24cf  3e 03        ld   a,0x03
 *   24d1  32 96 80     ld   (0x8096),a
 *   24d4  3e 00        ld   a,0x00
 *   24d6  32 94 80     ld   (0x8094),a
 *   24d9  32 97 80     ld   (0x8097),a
 *   24dc  32 a2 80     ld   (0x80a2),a
 *   24df  32 a4 80     ld   (0x80a4),a
 *   24e2  3c           inc  a
 *   24e3  32 a1 80     ld   (0x80a1),a
 *   24e6  3e 18        ld   a,0x18
 *   24e8  32 a3 80     ld   (0x80a3),a
 *   24eb  3e 01        ld   a,0x01
 *   24ed  32 9c 80     ld   (0x809c),a
 *   24f0  c3 7a 28     jp   0x287a
 *
 * Straight-line initialiser: writes 0x03 -> 0x8096; 0x00 -> 0x8094/0x8097/0x80a2/
 * 0x80a4; then A is INC'd to 0x01 and stored to 0x80a1; 0x18 -> 0x80a3; 0x01 ->
 * 0x809c. It ends with `jp 0x287a`, a TAIL-jump that pushes nothing, so it is
 * modelled as a call to loc_287a whose result is returned straight through — the
 * target's own `ret` pops loc_24cf's caller's return address and lands one frame
 * up, exactly as the discarded return address demands. (A separate m.ret() here
 * would pop a second time; see games/dkong/translated/loc_0cf2.js for the same
 * `return m.call(target)` tail idiom.)
 *
 * The `inc a` computes flags via regs.inc8 (S/Z/H/PV set from 0x00->0x01, carry
 * preserved): 0x01 is non-zero and bit-7 clear, so Z and S clear, H clear, and
 * carry was already 0 — F becomes 0x00, which the ld stores that follow leave
 * untouched, so the flags are 0x00 live into the tail-jump.
 */
export function loc_24cf(m) {
  const { regs, mem } = m;
  regs.a = 0x03;
  m.step(0x24d1, 7); // ld a,0x03
  mem.write8(0x8096, regs.a);
  m.step(0x24d4, 13); // ld (0x8096),a
  regs.a = 0x00;
  m.step(0x24d6, 7); // ld a,0x00
  mem.write8(0x8094, regs.a);
  m.step(0x24d9, 13); // ld (0x8094),a
  mem.write8(0x8097, regs.a);
  m.step(0x24dc, 13); // ld (0x8097),a
  mem.write8(0x80a2, regs.a);
  m.step(0x24df, 13); // ld (0x80a2),a
  mem.write8(0x80a4, regs.a);
  m.step(0x24e2, 13); // ld (0x80a4),a
  regs.a = regs.inc8(regs.a);
  m.step(0x24e3, 4); // inc a
  mem.write8(0x80a1, regs.a);
  m.step(0x24e6, 13); // ld (0x80a1),a
  regs.a = 0x18;
  m.step(0x24e8, 7); // ld a,0x18
  mem.write8(0x80a3, regs.a);
  m.step(0x24eb, 13); // ld (0x80a3),a
  regs.a = 0x01;
  m.step(0x24ed, 7); // ld a,0x01
  mem.write8(0x809c, regs.a);
  m.step(0x24f0, 13); // ld (0x809c),a
  m.step(0x287a, 10); // jp 0x287a -- TAIL (discards no return of its own)
  return m.call(0x287a);
}
