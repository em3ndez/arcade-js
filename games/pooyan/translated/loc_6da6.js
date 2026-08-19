// SPDX-License-Identifier: GPL-3.0-only

const DISPATCH_TABLE_6DAA = "0x6daa (level-intro phase, selector 0x8f51): 0..6 = 6db8 6e59 6f42 6f5e 6f9d 7032 705f";

// loc_6da6  (ROM 0x6da6-0x6da9) -- level-intro / round-start phase dispatcher. Reads the phase
// counter (0x8f51) and rst 0x28 tail-dispatches through the inline 7-word table at 0x6daa; the
// selected handler ret's straight to loc_6da6's own caller (no handler-return is pushed first --
// a pure tail dispatch, unlike loc_0899 which pushes a shared epilogue address).
export function loc_6da6(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8f51);
  m.step(0x6da9, 13); // 6da6  ld a,(0x8f51)
  m.push16(0x6daa);
  m.step(0x0028, 11); // 6da9  rst 0x28 -- pushes inline table base 0x6daa
  return m.call(0x0028, DISPATCH_TABLE_6DAA);
}
