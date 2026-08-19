// SPDX-License-Identifier: GPL-3.0-only

// loc_76ea  (ROM 0x76ea-0x76f3) -- a per-frame driver reached via `jp nz,0x76ea` (0x0b1e/0x6e4f).
// Runs three subsystems in order: loc_76f4 (advance the 6-object state table at 0x8ba0), 0x7625,
// then 0x02ef, and returns. Sits just past loc_76af's data block in the same ROM page.
export function loc_76ea(m) {
  m.push16(0x76ed);
  m.step(0x76f4, 17); // 76ea  call 0x76f4
  m.call(0x76f4);
  m.push16(0x76f0);
  m.step(0x7625, 17); // 76ed  call 0x7625
  m.call(0x7625);
  m.push16(0x76f3);
  m.step(0x02ef, 17); // 76f0  call 0x02ef
  m.call(0x02ef);
  m.ret(); // 76f3  ret
}
