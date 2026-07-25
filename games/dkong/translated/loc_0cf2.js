// SPDX-License-Identifier: GPL-3.0-only

/** loc_0cf2  (ROM 0x0CF2–0x0CFF) — Board 3 (75m elevator) setup: clear a sprite row,
 *  (0x6089)=0x0A mode, DE=layout ptr; tail-jumps to loc_0cc6 (DE live-out). */
export function loc_0cf2(m) {
  const { regs, mem } = m;
  m.push16(0x0cf5);
  m.step(0x0d27, 17); // call 0x0d27 -- sprite-row clear
  m.call(0x0d27);
  regs.a = 0x0a;
  m.step(0x0cf7, 7); // ld a,0x0a
  mem.write8(0x6089, regs.a);
  m.step(0x0cfa, 13); // ld (0x6089),a -- board mode 0x0A
  regs.de = 0x3be5;
  m.step(0x0cfd, 10); // ld de,0x3be5 -- elevator layout ptr (live-out, set last)
  m.step(0x0cc6, 10); // jp 0x0cc6 -- TAIL
  return m.call(0x0cc6);
}
