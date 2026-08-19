// SPDX-License-Identifier: GPL-3.0-only

// loc_72a0  (ROM 0x72a0-0x72a6) -- bonus phase 1 body: run the shared per-frame update (0x20d4) then
// the eagle-launch driver (0x72a7), and return.
export function loc_72a0(m) {
  m.push16(0x72a3);
  m.step(0x20d4, 17); // 72a0  call 0x20d4
  m.call(0x20d4);
  m.push16(0x72a6);
  m.step(0x72a7, 17); // 72a3  call 0x72a7
  m.call(0x72a7);
  m.ret(); // 72a6  ret
}
