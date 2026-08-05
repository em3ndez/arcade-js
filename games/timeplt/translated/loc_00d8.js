// SPDX-License-Identifier: GPL-3.0-only

// loc_00d8  (ROM 0x00D8-0x00D8) — falls through into 0x00D9, which owns the shared body.
export function loc_00d8(m) {
  const { regs, mem } = m;

  m.push16(regs.af);
  m.step(0x00d9, 11); // push af

  return m.call(0x00d9);
}
