// SPDX-License-Identifier: GPL-3.0-only
//
// loc_28ad  (ROM 0x28ad-0x28c4) -- 0x8f30 state 3 (dispatch 0x277e[3]). Runs the 0x8f34 hold counter
// (dec + return while non-zero); on expiry it bumps 0x8f30 and, unless (0x8f50) is set, clears the
// 0x18-byte record at (0x8f32) (rst 0x10 fill = 0). The rst 0x10 return address is loc_28c5 (a bare
// ret). rst 0x10 = loc_0010.
export function loc_28ad(m) {
  const { regs, mem } = m;

  regs.hl = 0x8f34; m.step(0x28b0, 10);
  regs.a = mem.read8(regs.hl); m.step(0x28b1, 7); // 28b0  ld a,(hl)
  regs.and(regs.a); m.step(0x28b2, 4);
  if (regs.fZ) {
    m.step(0x28b6, 12);
  } else {
    m.step(0x28b4, 7);
    regs.decMem8(mem, regs.hl); m.step(0x28b5, 11); // 28b4  dec (hl)
    m.ret();
    return;
  }
  regs.l = 0x30; m.step(0x28b8, 7); // 28b6  ld l,0x30 -> 0x8f30
  regs.incMem8(mem, regs.hl); m.step(0x28b9, 11); // 28b8  inc (hl)
  regs.a = mem.read8(0x8f50); m.step(0x28bc, 13); // 28b9  ld a,(0x8f50)
  regs.and(regs.a); m.step(0x28bd, 4);
  if (regs.fNZ) { m.ret(11); return; }
  m.step(0x28be, 5);
  regs.xor(regs.a); m.step(0x28bf, 4);
  regs.hl = mem.read16(0x8f32); m.step(0x28c2, 16); // 28bf  ld hl,(0x8f32)
  regs.b = 0x18; m.step(0x28c4, 7);
  m.push16(0x28c5); m.step(0x0010, 11); m.call(0x0010); // 28c4  rst 0x10 (fill 0x18 = 0)
  return m.call(0x28c5);
}
