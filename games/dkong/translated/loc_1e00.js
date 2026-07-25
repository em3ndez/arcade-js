// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1e00  (ROM 0x1E00–0x1E07) — setter; loc_1dc9 tail-jumps here.
 *
 *   1e00  06 7d        ld   b,0x7d
 *   1e02  11 03 00     ld   de,0x0003
 *   1e05  c3 15 1e     jp   0x1e15
 *
 * Sets the (B, DE) parameters and tail-jumps to the shared continuation loc_1e15
 * (a TAIL JUMP: 0x1E05 is 0xC3/jp, no return address pushed).
 */
export function loc_1e00(m) {
  const { regs } = m;

  regs.b = 0x7d;
  m.step(0x1e02, 7); // ld b,0x7d
  regs.de = 0x0003;
  m.step(0x1e05, 10); // ld de,0x0003
  m.step(0x1e15, 10); // jp 0x1e15 (tail jump, no push16)
  return m.call(0x1e15);
}
