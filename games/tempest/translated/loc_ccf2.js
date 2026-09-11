// SPDX-License-Identifier: GPL-3.0-only
// loc_ccf2 (ROM 0xccf2-0xccf5) -- seeds A=$7f then falls into shared body $ccc3. bne is always taken
// (A != 0), same-page (3 cyc), so this is an unconditional branch-delegate to $ccc3 (no push).
export function loc_ccf2(m) {
  const { regs } = m;
  regs.a = 0x7f; regs.setNZ(regs.a); m.step(0xccf4, 2);
  m.step(0xccc3, 3); return m.call(0xccc3); // bne 0xccc3 always taken -> delegate
}
