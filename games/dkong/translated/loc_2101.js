// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2101  (ROM 0x2101–0x2103) — the 20ec branch tail (was `defb`-hidden). call 24b4.
 *  fall into loc_2104.
 */
export function loc_2101(m) {
  m.push16(0x2104);
  m.step(0x24b4, 17); // call 0x24b4
  if (!m.call(0x24b4)) return; // skip-capable: spliced to 21ba/loop -> do NOT continue inline
  return m.call(0x2104);
}
