// SPDX-License-Identifier: GPL-3.0-only

// loc_0986  (ROM 0x0986-0x099b) -- attract sub-state 3 (dispatch target 0x08a1[3]).
// A pure countdown gate: decrement the frame counter (0x8e50) and `ret nz` while it is
// still running. On the tick it reaches zero, zero-fill scratch (0x02b9), reset the tile
// pointer (0x02e3), advance the sub-state (0x8e51), and seat 0x0b26 at the (0x8f48) vector.
// Every `m.step(next, T)` carries the landing address, so the flow reads without per-line notes.
export function loc_0986(m) {
  const { regs, mem } = m;

  regs.hl = 0x8e50; m.step(0x0989, 10);
  regs.decMem8(mem, regs.hl); m.step(0x098a, 11); // 0989  dec (hl) -- countdown
  if (regs.fNZ) { m.ret(11); return; } // 098a  ret nz -- still counting
  m.step(0x098b, 5);

  m.push16(0x098e); m.step(0x02b9, 17); m.call(0x02b9); // 098b  call 0x02b9
  m.push16(0x0991); m.step(0x02e3, 17); m.call(0x02e3); // 098e  call 0x02e3
  regs.hl = 0x8e51; m.step(0x0994, 10);
  regs.incMem8(mem, regs.hl); m.step(0x0995, 11); // 0994  inc (hl) -- next sub-state
  regs.hl = 0x0b26; m.step(0x0998, 10);
  mem.write16(0x8f48, regs.hl); m.step(0x099b, 16); // 0998  ld (0x8f48),hl
  m.ret(); // 099b  ret
}
