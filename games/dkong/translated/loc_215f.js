// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_215f  (ROM 0x215F–0x216A) — set up (D=L+5, A=H, BC=0x15), call sub_216d, tail.
 */
export function loc_215f(m) {
  const { regs } = m;
  regs.a = regs.l;
  m.step(0x2160, 4); // ld a,l
  regs.add(0x05);
  m.step(0x2162, 7); // add a,0x05
  regs.d = regs.a; // D = L + 5
  m.step(0x2163, 4); // ld d,a
  regs.a = regs.h; // A = H
  m.step(0x2164, 4); // ld a,h
  regs.bc = 0x0015;
  m.step(0x2167, 10); // ld bc,0x0015
  m.push16(0x216a);
  m.step(0x216d, 17); // call 0x216d
  m.call(0x216d); // may abort (216d hidden-exit); jp below runs on normal return
  m.step(0x21ba, 10); // jp 0x21ba -- NON-exx'd entry
  return m.call(0x21ba);
}
