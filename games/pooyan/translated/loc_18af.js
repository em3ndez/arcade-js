// SPDX-License-Identifier: GPL-3.0-only

// loc_18af  (ROM 0x18af-0x18d9) -- gameplay-state idx4 per-frame coordinator: a straight-line sequence
// of 14 sub-handler calls (canonical push16/step/call; each callee pops the return pushed here), then ret.
export function loc_18af(m) {
  m.push16(0x18b2); m.step(0x1e55, 17); m.call(0x1e55);
  m.push16(0x18b5); m.step(0x6cab, 17); m.call(0x6cab);
  m.push16(0x18b8); m.step(0x20d4, 17); m.call(0x20d4);
  m.push16(0x18bb); m.step(0x511b, 17); m.call(0x511b);
  m.push16(0x18be); m.step(0x3377, 17); m.call(0x3377);
  m.push16(0x18c1); m.step(0x40bd, 17); m.call(0x40bd);
  m.push16(0x18c4); m.step(0x02ef, 17); m.call(0x02ef);
  m.push16(0x18c7); m.step(0x18da, 17); m.call(0x18da);
  m.push16(0x18ca); m.step(0x191c, 17); m.call(0x191c);
  m.push16(0x18cd); m.step(0x5ae4, 17); m.call(0x5ae4);
  m.push16(0x18d0); m.step(0x196e, 17); m.call(0x196e);
  m.push16(0x18d3); m.step(0x1f2f, 17); m.call(0x1f2f);
  m.push16(0x18d6); m.step(0x6b3b, 17); m.call(0x6b3b);
  m.push16(0x18d9); m.step(0x19ca, 17); m.call(0x19ca);
  return m.ret(10);
}
