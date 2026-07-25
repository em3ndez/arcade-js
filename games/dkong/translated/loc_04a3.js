// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_04a3  (ROM 0x04A3–0x04A6) — write colour column (sub_0514), then read (0x6905) for the blink flip.
 */
export function loc_04a3(m) {
  const { regs, mem } = m;
  regs.hl = 0x75c4;
  m.step(0x04a6, 10); // ld hl,0x75c4
  m.push16(0x04a9); m.step(0x0514, 17); m.call(0x0514); // call 0x0514
  regs.a = mem.read8(0x6905);
  m.step(0x04ac, 13); // ld a,(0x6905) -- falls into loc_04ac
  return m.call(0x04ac);
}
