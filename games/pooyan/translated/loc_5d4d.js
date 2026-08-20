// SPDX-License-Identifier: GPL-3.0-only

// loc_5d4d  (ROM 0x5d4d-0x5d67) -- run the proximity test loc_5d68 for 3 target objects against the
// fixed source IX=0x889c. IY walks the targets at 0x887c (stride 4), HL walks the records at 0x8be8
// (stride 0x18). loc_5d68 rets normally when there is no hit; the loop advances IY/HL and repeats.
export function loc_5d4d(m) {
  const { regs } = m;

  regs.ix = 0x889c;            m.step(0x5d51, 14);
  regs.iy = 0x887c;            m.step(0x5d55, 14);
  regs.hl = 0x8be8;            m.step(0x5d58, 10);
  regs.b = 0x03;               m.step(0x5d5a, 7);

  for (;;) { // 5d5a: proximity-check one target per iteration
    m.push16(0x5d5d); m.step(0x5d68, 17); m.call(0x5d68); // 5d5a  call 0x5d68
    if (m.pc !== 0x5d5d) return;   // loc_5d68 skip-returned past this loop; propagate
    regs.de = 0x0004;          m.step(0x5d60, 10);
    regs.addIy(regs.de);       m.step(0x5d62, 15); // IY += 4
    regs.e = 0x18;             m.step(0x5d64, 7);
    regs.addHl(regs.de);       m.step(0x5d65, 11); // HL += 0x18
    if (regs.djnz()) { m.step(0x5d5a, 13); continue; }
    m.step(0x5d67, 8);
    break;
  }

  return m.ret(10); // 5d67  ret
}
