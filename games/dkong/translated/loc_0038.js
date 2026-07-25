// SPDX-License-Identifier: GPL-3.0-only

/** loc_0038  (ROM 0x0038–0x003C) — the rst 0x38 entry: fixes stride 4 and count 10, then falls through into sub_003d. */
export function loc_0038(m) {
  const { regs } = m;

  regs.de = 0x0004; // the stride
  m.step(0x003b, 10); // ld de,0x0004
  regs.b = 0x0a; // ten bytes
  m.step(0x003d, 7); // ld b,0x0a

  // FALL-THROUGH, not a call: nothing is pushed here, and sub_003d's `ret`
  // pops whatever the `rst 0x38` pushed at the call site.
  m.call(0x003d);
}
