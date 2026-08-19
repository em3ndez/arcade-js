// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2b8d  (ROM 0x2b8d-0x2b99) -- shared dispatch epilogue (pushed as the handler return by
// loc_28c6, and fallen into by loc_2b59). When the actor count (0x8a82) reaches 3 it runs the two
// spawn/formation helpers loc_2b9a and loc_2c2c; below that it just returns. Both are pattern A.
export function loc_2b8d(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8a82); m.step(0x2b90, 13); // 2b8d  ld a,(0x8a82)
  regs.cp(0x03); m.step(0x2b92, 7); // 2b90  cp 0x03
  if (regs.fC) { m.ret(11); return; } // 2b92  ret c
  m.step(0x2b93, 5);
  m.push16(0x2b96); m.step(0x2b9a, 17); m.call(0x2b9a); // 2b93  call 0x2b9a (pattern A)
  m.push16(0x2b99); m.step(0x2c2c, 17); m.call(0x2c2c); // 2b96  call 0x2c2c (pattern A)
  m.ret(); // 2b99  ret
}
