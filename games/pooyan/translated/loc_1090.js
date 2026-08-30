// SPDX-License-Identifier: GPL-3.0-only

// loc_1090  (ROM 0x1090-0x10a1) -- main-loop sub-state 2 handler: a frame-delay countdown at
// 0x8f62. If the counter (0x8f62) is nonzero, decrement it and return (keep waiting). When it
// reaches zero it falls through to loc_1099: advance the sub-state selector (inc (0x8f5c)) and
// queue display command 0x0634 via rst 0x38 (loc_0038 enqueue), then ret.
export function loc_1090(m) {
  const { regs, mem } = m;

  regs.hl = 0x8f62;
  m.step(0x1093, 10); // 1090  ld hl,0x8f62
  regs.a = mem.read8(regs.hl);
  m.step(0x1094, 7); // 1093  ld a,(hl)
  regs.and(regs.a);
  m.step(0x1095, 4); // 1094  and a

  if (regs.fZ) {
    m.step(0x1099, 12); // 1095  jr z,0x1099 (taken) -- counter expired
    // loc_1099:
    regs.hl = 0x8f5c;
    m.step(0x109c, 10); // 1099  ld hl,0x8f5c
    regs.incMem8(mem, regs.hl);
    m.step(0x109d, 11); // 109c  inc (hl) -- advance sub-state selector
    regs.de = 0x0634;
    m.step(0x10a0, 10); // 109d  ld de,0x0634
    m.push16(0x10a1); m.step(0x0038, 11); m.call(0x0038, "rst 0x38 -- queue display cmd 0x0634"); // 10a0  rst 0x38
    m.ret(); // 10a1  ret
    return;
  }

  m.step(0x1097, 7); // 1095  jr z (not taken) -- still counting
  regs.decMem8(mem, regs.hl);
  m.step(0x1098, 11); // 1097  dec (hl) -- tick the delay counter
  m.ret(); // 1098  ret
}
