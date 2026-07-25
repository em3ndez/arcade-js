// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2b8b  (ROM 0x2B8B–0x2B8F) — (0x6210)==0 variant of the X adjust.
 */
export function loc_2b8b(m) {
  const { regs } = m;
  regs.sub(0x08);
  m.step(0x2b8d, 7); // sub 0x08
  regs.or(0x07);
  m.step(0x2b8f, 7); // or 0x07
  regs.add(0x04);
  m.step(0x2b91, 7); // add a,0x04 -- falls into loc_2b91
  return m.call(0x2b91);
}
