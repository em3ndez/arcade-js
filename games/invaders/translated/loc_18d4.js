// SPDX-License-Identifier: GPL-3.0-only
// loc_18d4  (ROM 0x18d4-0x18de) -- BOOT INIT, reached by `jmp 0x18d4` at the reset vector
// (loc_0000). Seats SP at the top of work RAM, clears B, runs the two init subroutines
// (0x01e6, 0x1956), then falls through into loc_18df (its own entry -- also `jmp 0x18df`
// at 0x0be5), so it delegates rather than inlining across the boundary.
export function loc_18d4(m) {
  const { regs } = m;

  regs.sp = 0x2400; m.step(0x18d7, 10); // 18d4  lxi sp,0x2400
  regs.b = 0x00; m.step(0x18d9, 7); // 18d7  mvi b,0x00
  m.push16(0x18dc); m.step(0x01e6, 17); m.call(0x01e6); // 18d9  call 0x01e6
  m.push16(0x18df); m.step(0x1956, 17); m.call(0x1956); // 18dc  call 0x1956
  return m.call(0x18df); // 18df  fall through into loc_18df (its own entry)
}
