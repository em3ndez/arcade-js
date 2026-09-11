// SPDX-License-Identifier: GPL-3.0-only
// loc_aa69  (ROM 0xaa69-0xaa6e) -- calls loc_aa92 then tail-jumps to loc_a8e7.
export function loc_aa69(m) {
  m.push16(0xaa6b); m.step(0xaa6c, 6); m.call(0xaa92);
  m.step(0xa8e7, 3); return m.call(0xa8e7);
}
