// SPDX-License-Identifier: GPL-3.0-only
// loc_24ff  (ROM 0x24ff-0x2505) -- calls loc_21c7 then loc_20e8, then falls into loc_2505.
export function loc_24ff(m) {
  const { regs, mem } = m;
  m.step(0x2502, 6); m.call(0x21c7);                                    // 24ff jsr $21c7
  m.step(0x2505, 6); m.call(0x20e8);                                    // 2502 jsr $20e8
  return m.call(0x2505);                                                // fall into loc_2505
}
