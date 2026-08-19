// SPDX-License-Identifier: GPL-3.0-only

// loc_71c7  (ROM 0x71c7-0x71cd) -- bonus phase 0 body: run the eagle/arrow state machine (0x71ce)
// then the shared per-frame update (0x20d4), and return.
export function loc_71c7(m) {
  m.push16(0x71ca);
  m.step(0x71ce, 17); // 71c7  call 0x71ce
  m.call(0x71ce);
  m.push16(0x71cd);
  m.step(0x20d4, 17); // 71ca  call 0x20d4
  m.call(0x20d4);
  m.ret(); // 71cd  ret
}
