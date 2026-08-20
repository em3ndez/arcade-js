// SPDX-License-Identifier: GPL-3.0-only

// loc_588e  (ROM 0x588e-0x589a) -- per-eagle init loop over B sprite blocks. For each block calls
// loc_572b with E=0x04 (init the block IX points at), then advances IX by 0x18 to the next block.
export function loc_588e(m) {
  const { regs, mem } = m;

  for (;;) { // loc_588e
    regs.e = 0x04;                m.step(0x5890, 7);
    m.push16(0x5893);
    m.step(0x572b, 17);           // 5890  call 0x572b
    m.call(0x572b);
    if (m.pc !== 0x5893) return;   // loc_572b full-path skip-returned past this loop; propagate
    regs.de = 0x0018;             m.step(0x5896, 10);
    regs.addIx(regs.de);          m.step(0x5898, 15); // add ix,de
    if (regs.djnz()) { m.step(0x588e, 13); continue; }
    m.step(0x589a, 8);
    break;
  }
  m.ret();
}
