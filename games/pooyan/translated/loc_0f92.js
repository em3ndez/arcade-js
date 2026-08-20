// SPDX-License-Identifier: GPL-3.0-only

// loc_0f92  (ROM 0x0f92-0x0f96) -- a 2-instruction command trampoline: load display-command 0x1d into
// A and tail-jump to the 0x0fc3 command dispatcher (which ret's to loc_0f92's caller). Reached from
// loc_1a96 (the phase-count-zero path).
export function loc_0f92(m) {
  m.regs.a = 0x1d;
  m.step(0x0f94, 7); // 0f92  ld a,0x1d
  m.step(0x0fc3, 10);
  return m.call(0x0fc3); // 0f94  jp 0x0fc3
}
