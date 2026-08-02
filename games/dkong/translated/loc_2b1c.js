// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2b1c  (ROM 0x2B1C–0x2B28) — (calls entry_2b29 then sub_29af; IX = 0x6200).
 * entry_2b29 is a CALLER-SKIP: on every exit but 0x2B70 (ret z) it does pop hl / ret,
 * unwinding PAST loc_2b1c. So `if (!m.call(0x2b29)) return;` -- the skip already
 * unwound to loc_2b1c's caller. Only the normal (true) return reaches sub_29af.
 * Translated for completeness; not yet wired into the live dispatcher.
 */
export function loc_2b1c(m) {
  const { regs } = m;
  regs.ix = 0x6200;
  m.step(0x2b20, 14); // ld ix,0x6200
  m.push16(0x2b23); m.step(0x2b29, 17); // call 0x2b29
  if (!m.call(0x2b29)) return; // caller-skip: 2b29 (or its 2b9b double-skip) unwound past 2b1c
  m.push16(0x2b26); m.step(0x29af, 17); m.call(0x29af); // call 0x29af
  regs.xor(regs.a);
  m.step(0x2b27, 4); // xor a
  regs.b = regs.a;
  m.step(0x2b28, 4); // ld b,a -- B = 0
  m.ret(); // ret (0x2B28) -- only if entry_2b29 returned NORMALLY
}
