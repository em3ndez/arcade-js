// SPDX-License-Identifier: GPL-3.0-only

// loc_68f8  (ROM 0x68f8-0x6904) -- per-frame group update: calls four sub-passes in order then rets.
export function loc_68f8(m) {
  m.push16(0x68fb); m.step(0x6905, 17); m.call(0x6905);
  m.push16(0x68fe); m.step(0x69ad, 17); m.call(0x69ad);
  m.push16(0x6901); m.step(0x6a0f, 17); m.call(0x6a0f);
  m.push16(0x6904); m.step(0x6a7f, 17); m.call(0x6a7f);
  return m.ret(10); // 6904  ret
}
