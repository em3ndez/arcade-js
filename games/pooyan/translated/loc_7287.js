// SPDX-License-Identifier: GPL-3.0-only

// loc_7287  (ROM 0x7287-0x7291) -- eagle grid-advance guard. While the eagle X (0x8c94) is below
// 0xd0 it just returns; once it reaches the edge it arms the finish flag (0x8f3e)=1 and falls through
// into loc_7292 (the phase-reset epilogue), which returns to this routine's caller.
export function loc_7287(m) {
  const { regs, mem } = m;

  regs.a = mem.read8(0x8c94);
  m.step(0x728a, 13); // 7287  ld a,(0x8c94)
  regs.cp(0xd0);
  m.step(0x728c, 7); // 728a  cp 0xd0
  if (regs.fC) { m.ret(11); return; } // 728c  ret c
  m.step(0x728d, 5);
  regs.a = 0x01;
  m.step(0x728f, 7); // 728d  ld a,0x01
  mem.write8(0x8f3e, regs.a);
  m.step(0x7292, 13); // 728f  ld (0x8f3e),a -- fall through into loc_7292
  return m.call(0x7292);
}
