// SPDX-License-Identifier: GPL-3.0-only

// loc_5146  (ROM 0x5146-0x514f) -- boot-frontier trampoline: three sequential calls (0x5150,
// 0x52f6, 0x5334), then ret. Each call pushes the address of the following instruction.
export function loc_5146(m) {
  m.push16(0x5149); m.step(0x5150, 17); m.call(0x5150); // 5146  call 0x5150
  m.push16(0x514c); m.step(0x52f6, 17); m.call(0x52f6); // 5149  call 0x52f6
  m.push16(0x514f); m.step(0x5334, 17); m.call(0x5334); // 514c  call 0x5334
  return m.ret(10); // 514f  ret
}
