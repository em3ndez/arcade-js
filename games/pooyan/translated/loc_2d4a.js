// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2d4a  (ROM 0x2d4a-0x2d50) -- hunter dispatch state 3 (rst 0x2c50[3]). Clears the 0x8f36 flag,
// then `pop af; ret` (false -- caller-skip aborting loc_2c2c / discarding the epilogue return).
export function loc_2d4a(m) {
  const { regs, mem } = m;

  regs.a = 0x00; m.step(0x2d4c, 7); // 2d4a  ld a,0x00
  mem.write8(0x8f36, regs.a); m.step(0x2d4f, 13); // 2d4c  ld (0x8f36),a
  regs.af = m.pop16(); m.step(0x2d50, 10); // 2d4f  pop af (discard caller return)
  m.ret(); return false; // 2d50  ret -- caller-skip
}
