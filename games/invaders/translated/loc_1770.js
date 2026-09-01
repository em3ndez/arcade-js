// SPDX-License-Identifier: GPL-3.0-only
// loc_1770  (ROM 0x1770-0x1774) -- sound-off tail, a secondary entry into loc_176d's body
// (`call 0x1770` at 0x0753 enters here, skipping the lda): mask the caller's A to the two
// high sound bits (0x30) and write it to port 5, then return.
export function loc_1770(m) {
  const { regs } = m;

  regs.and(0x30); m.step(0x1772, 7); // 1770  ani 0x30
  m.io.portOut(0x05, regs.a); m.step(0x1774, 10); // 1772  out 0x05
  return m.ret(10); // 1774  ret
}
