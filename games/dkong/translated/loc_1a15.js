// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1a15  (ROM 0x1A15–0x1A1E) — idx1 INIT: clear (0x6387), advance state (0x6386) to 2; falls into 0x1A1E ret.
 */
export function loc_1a15(m) {
  const { regs, mem } = m;
  regs.xor(regs.a);
  m.step(0x1a16, 4); // xor a
  mem.write8(0x6387, regs.a);
  m.step(0x1a19, 13); // ld (0x6387),a -- counter := 0 (BEFORE state)
  regs.a = 0x02;
  m.step(0x1a1b, 7); // ld a,0x02
  mem.write8(0x6386, regs.a);
  m.step(0x1a1e, 13); // ld (0x6386),a -- state := 2 -> falls into 0x1A1E
  m.ret(10); // 0x1A1E ret -> loc_197a
}
