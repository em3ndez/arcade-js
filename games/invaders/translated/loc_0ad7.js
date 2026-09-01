// SPDX-License-Identifier: GPL-3.0-only
// loc_0ad7  (ROM 0x0ad7-0x0ae1) -- store A into the counter at 0x20c0, then spin at
// loc_0ada until that counter reaches zero (an interrupt-decremented delay), then ret.
// Reached by `jmp 0x0ad7` from loc_0ab1/loc_0ab6 (outside this band).
export function loc_0ad7(m) {
  const { regs, mem } = m;

  mem.write8(0x20c0, regs.a); m.step(0x0ada, 13); // 0ad7  sta 0x20c0

  for (;;) { // loc_0ada: wait for 0x20c0 == 0
    regs.a = mem.read8(0x20c0); m.step(0x0add, 13); // 0ada  lda 0x20c0
    regs.and(regs.a); m.step(0x0ade, 4); // 0add  ana a
    if (regs.fNZ) { m.step(0x0ada, 10); continue; } // 0ade  jnz 0x0ada
    m.step(0x0ae1, 10); break; // fall to ret
  }
  return m.ret(10); // 0ae1  ret
}
