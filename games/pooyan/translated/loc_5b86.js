// SPDX-License-Identifier: GPL-3.0-only

// loc_5b86  (ROM 0x5b86-0x5b98) -- run loc_5b99 over the six 0x18-byte objects starting at 0x8ae0.
// IX walks the table (+0x18 per object); the exx pair parks the B loop-counter and DE stride in the
// alternate set so loc_5b99 cannot clobber them. The djnz 0x5b96 -> 0x5b8f latch is the loop body
// (0x5b8f is not an external entry; inlined here). loc_5b99 is a translated in-batch call target.
export function loc_5b86(m) {
  const { regs } = m;

  regs.ix = 0x8ae0;                m.step(0x5b8a, 14);
  regs.de = 0x0018;                m.step(0x5b8d, 10);
  regs.b = 0x06;                   m.step(0x5b8f, 7);

  for (;;) { // loc_5b8f: loop head (djnz latch)
    regs.exx();                    m.step(0x5b90, 4);
    m.push16(0x5b93);
    m.step(0x5b99, 17);            // 5b90  call 0x5b99
    m.call(0x5b99);
    if (m.pc !== 0x5b93) return;   // loc_5b99 hit-exit `pop af;ret` unwound two levels to loc_5ae4 (0x5afc); propagate
    regs.exx();                    m.step(0x5b94, 4);
    regs.addIx(regs.de);           m.step(0x5b96, 15);
    if (regs.djnz()) { m.step(0x5b8f, 13); } else { m.step(0x5b98, 8); break; }
  }

  return m.ret(10);
}
