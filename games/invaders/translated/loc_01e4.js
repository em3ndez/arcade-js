// SPDX-License-Identifier: GPL-3.0-only
// loc_01e4  (ROM 0x01e4-0x01e5) -- called from 0x0302/0x07f3/0x09fd/0x0b5d. Presets B=0xc0 then
// falls through into the shared entry loc_01e6 (next band) rather than inlining across it.
export function loc_01e4(m) {
  const { regs } = m;

  regs.b = 0xc0; m.step(0x01e6, 7); // 01e4  mvi b,0xc0
  return m.call(0x01e6); // fall through into loc_01e6
}
