// SPDX-License-Identifier: GPL-3.0-only

// loc_0f3e  (ROM 0x0F3E-0x0F58) — the attract animator's per-cell frame clock. Decrements the tick
// timer (0x83BD); until it elapses, 0x0F56 pops its own frame AND the caller's return and rets
// straight to loc_0e7a's caller (a DOUBLE caller-skip, since the arm reached the tail via jp(hl)).
// On elapse it advances the frame index (0x83BE, wrapping 0->4) and returns the 0x2E1B-table tile in
// A. Returns false on the 0x0F56 skip-out (already ret'd), true on the normal return.
export function loc_0f3e(m) {
  const { regs, mem } = m;

  m.push16(regs.hl);
  m.step(0x0f3f, 11);

  regs.hl = 0x83bd;
  m.step(0x0f42, 10);

  regs.decMem8(mem, regs.hl);
  m.step(0x0f43, 11); // dec (0x83bd) -- the per-cell frame timer

  if (regs.fNZ) {
    // loc_0f56: not elapsed -- pop this frame's saved HL, pop the arm's return, ret to loc_0e7a's caller
    m.step(0x0f56, 12);
    m.pop16();
    m.step(0x0f57, 10); // pop af -- discard the saved HL
    m.pop16();
    m.step(0x0f58, 10); // pop af -- discard the arm's return address
    m.ret();
    return false;
  }
  m.step(0x0f45, 7);

  mem.write8(regs.hl, 0x08);
  m.step(0x0f47, 10); // (0x83bd) = 0x08 -- reload the frame timer

  regs.l = regs.inc8(regs.l);
  m.step(0x0f48, 4);

  regs.decMem8(mem, regs.hl);
  m.step(0x0f49, 11);

  if (regs.fNZ) {
    m.step(0x0f4d, 12);
  } else {
    m.step(0x0f4b, 7);
    mem.write8(regs.hl, 0x04);
    m.step(0x0f4d, 10); // (0x83be) = 0x04 -- wrap the frame index
  }

  // loc_0f4d:
  regs.a = mem.read8(regs.hl);
  m.step(0x0f4e, 7); // A = (0x83be) frame index

  regs.hl = 0x2e1b;
  m.step(0x0f51, 10); // HL = 0x2e1b -- the animation-tile table base

  regs.add(regs.l);
  m.step(0x0f52, 4);

  regs.l = regs.a;
  m.step(0x0f53, 4);

  regs.a = mem.read8(regs.hl);
  m.step(0x0f54, 7); // A = (0x2e1b + index) -- this frame's tile

  regs.hl = m.pop16();
  m.step(0x0f55, 10);

  m.ret();
  return true;
}
