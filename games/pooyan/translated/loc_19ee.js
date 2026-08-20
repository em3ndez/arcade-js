// SPDX-License-Identifier: GPL-3.0-only

// loc_19ee  (ROM 0x19ee-0x1a00) -- gameplay-state per-frame coordinator: six ordered sub-handler
// calls (canonical push16/step/call; each callee pops the return pushed here), then ret.
export function loc_19ee(m) {
  m.push16(0x19f1); m.step(0x308b, 17); m.call(0x308b);
  m.push16(0x19f4); m.step(0x25a6, 17); m.call(0x25a6);
  m.push16(0x19f7); m.step(0x3377, 17); m.call(0x3377);
  m.push16(0x19fa); m.step(0x40bd, 17); m.call(0x40bd);
  m.push16(0x19fd); m.step(0x28c6, 17); m.call(0x28c6);
  m.push16(0x1a00); m.step(0x02ef, 17); m.call(0x02ef);
  return m.ret(10);
}
