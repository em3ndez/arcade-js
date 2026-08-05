// SPDX-License-Identifier: GPL-3.0-only

// loc_17fb  (ROM 0x17FB-0x17FD)
export function loc_17fb(m) {
  m.step(0x0f1a, 10); // 17fb  jp 0x0f1a -- TAIL jump, nothing pushed
  return m.call(0x0f1a);
}
