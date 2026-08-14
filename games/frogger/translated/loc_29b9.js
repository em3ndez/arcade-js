// SPDX-License-Identifier: GPL-3.0-only

// loc_29b9  (ROM 0x29B9-0x29C8) — IX sprite dispatcher A: runs the five per-slot handlers in ROM order
// (0x2A6A, 0x29C9, 0x29F9, 0x2AF3, 0x2B58) against the current IX/IY descriptor, then returns.
export function loc_29b9(m) {
  m.push16(0x29bc);
  m.step(0x2a6a, 17);
  m.call(0x2a6a);
  m.push16(0x29bf);
  m.step(0x29c9, 17);
  m.call(0x29c9);
  m.push16(0x29c2);
  m.step(0x29f9, 17);
  m.call(0x29f9);
  m.push16(0x29c5);
  m.step(0x2af3, 17);
  m.call(0x2af3);
  m.push16(0x29c8);
  m.step(0x2b58, 17);
  m.call(0x2b58);
  m.ret();
}
