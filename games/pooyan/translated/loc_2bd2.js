// SPDX-License-Identifier: GPL-3.0-only
//
// loc_2bd2  (ROM 0x2bd2-0x2bd2) -- a single `inc sp` that discards the low byte of the return pushed
// by the caller, then falls into loc_2bd3. Reached by `jr z 0x2bd2` from loc_2b59.
export function loc_2bd2(m) {
  const { regs } = m;

  regs.sp = (regs.sp + 1) & 0xffff; m.step(0x2bd3, 6); // 2bd2  inc sp
  return m.call(0x2bd3); // fall into loc_2bd3
}
