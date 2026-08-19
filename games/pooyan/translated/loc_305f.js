// SPDX-License-Identifier: GPL-3.0-only
//
// loc_305f  (ROM 0x305f-0x3086) -- rope-grab trigger test for loc_2f01. Looks up a catch window
// half-width from table 0x3087 (rst 0x20, keyed by IXL&3) and compares it against the player X
// (0x8a84)-0x07 window; if the player is outside the window it returns normally (true). Inside the
// window, and only when neither (0x8f24) nor (0x8f08) is busy, it fires the grab: sets (0x8d32)=1,
// runs loc_0f15, and `pop af; ret` (false -- caller-skip aborting loc_2f01). Table 0x3087 is ROM data.
export function loc_305f(m) {
  const { regs, mem } = m;

  regs.a = regs.ix & 0xff; m.step(0x3061, 8);
  regs.and(0x03); m.step(0x3063, 7);
  regs.hl = 0x3087; m.step(0x3066, 10);
  m.push16(0x3067); m.step(0x0020, 11); m.call(0x0020); // 3066  rst 0x20 (A := table_0x3087[A])
  regs.b = regs.a; m.step(0x3068, 4);
  regs.a = mem.read8(0x8a84); m.step(0x306b, 13); // 3068  ld a,(0x8a84)
  regs.sub(0x07); m.step(0x306d, 7);
  regs.c = regs.a; m.step(0x306e, 4);
  regs.add(0x0e); m.step(0x3070, 7);
  regs.cp(regs.b); m.step(0x3071, 4);
  if (regs.fC) { m.ret(11); return true; } // 3071  ret c (normal)
  m.step(0x3072, 5);
  regs.a = regs.c; m.step(0x3073, 4);
  regs.cp(regs.b); m.step(0x3074, 4);
  if (regs.fNC) { m.ret(11); return true; } // 3074  ret nc (normal)
  m.step(0x3075, 5);
  regs.hl = 0x8f24; m.step(0x3078, 10);
  regs.a = mem.read8(0x8f08); m.step(0x307b, 13); // 3078  ld a,(0x8f08)
  regs.or(mem.read8(regs.hl)); m.step(0x307c, 7); // 307b  or (hl)
  if (regs.fNZ) { m.ret(11); return true; } // 307c  ret nz (normal)
  m.step(0x307d, 5);
  regs.a = 0x01; m.step(0x307f, 7);
  mem.write8(0x8d32, regs.a); m.step(0x3082, 13); // 307f  ld (0x8d32),a
  m.push16(0x3085); m.step(0x0f15, 17); m.call(0x0f15);
  regs.af = m.pop16(); m.step(0x3086, 10); // 3085  pop af (discard caller return)
  m.ret(); return false; // 3086  ret -- caller-skip
}
