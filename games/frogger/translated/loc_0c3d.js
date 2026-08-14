// SPDX-License-Identifier: GPL-3.0-only

// loc_0c3d  (ROM 0x0C3D-0x0C49) — intro digit helper: BC = the (0x83FB) digit pair, DE = row-base/tile,
// then draw via loc_0c4a — CALLed @0x0C46 and FALLEN-THROUGH @0x0C49 (with C=B), so loc_0c4a runs twice.
export function loc_0c3d(m) {
  const { regs, mem } = m;

  regs.h = 0x80;
  m.step(0x0c3f, 7);

  regs.bc = mem.read16(0x83fb);
  m.step(0x0c43, 20); // ld bc,(0x83fb) -- BC = the digit pair (C=low, B=high)

  regs.de = 0x3004;
  m.step(0x0c46, 10);

  m.push16(0x0c49);
  m.step(0x0c4a, 17); // call 0x0c4a -- draw pass 1 (row from C=low digit)
  m.call(0x0c4a);

  regs.c = regs.b;
  m.step(0x0c4a, 4); // ld c,b -- C = high digit for pass 2

  return m.call(0x0c4a); // fall through into loc_0c4a -- draw pass 2 (runs it twice)
}
