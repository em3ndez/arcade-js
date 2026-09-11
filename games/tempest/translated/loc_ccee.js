// SPDX-License-Identifier: GPL-3.0-only
// loc_ccee (ROM 0xccee-0xccf1) -- seeds A=$6f then falls into shared body $ccc3. bne is always taken
// (A != 0), same-page (3 cyc), so this is an unconditional branch-delegate to $ccc3 (no push).
export function loc_ccee(m) {
  const { regs } = m;
  regs.a = 0x6f; regs.setNZ(regs.a); m.step(0xccf0, 2);
  m.step(0xccc3, 3); return m.call(0xccc3); // bne 0xccc3 always taken -> delegate
}
