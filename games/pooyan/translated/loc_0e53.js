// SPDX-License-Identifier: GPL-3.0-only

// loc_0e53  (ROM 0x0e53) -- one-byte null handler: `ret`. A display-list dispatch target (the table
// at 0x06f8 holds `dw 0x0e53`), so dispatching this entry just returns without drawing. Split out of
// the 0x0e00 batch range; it ends exactly at the 0x0e54 boundary (loc_0e54).
export function loc_0e53(m) {
  m.ret(); // 0e53  ret
}
