// SPDX-License-Identifier: GPL-3.0-only

// loc_53a0  (ROM 0x53a0-0x53a5) -- thin wrapper: seed C=0xff, call 0x5733, return.
export function loc_53a0(m) {
  const { regs } = m;

  regs.c = 0xff;                                m.step(0x53a2, 7);   // 53a0  ld c,0xff
  m.push16(0x53a5); m.step(0x5733, 17); m.call(0x5733);              // 53a2  call 0x5733
  if (m.pc !== 0x53a5) return;   // loc_5733 always `pop af;ret` skip-returns past this wrapper; propagate
  return m.ret(10);                                                  // 53a5  ret (dead: loc_5733 never returns here)
}
