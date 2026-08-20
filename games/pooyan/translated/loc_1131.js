// SPDX-License-Identifier: GPL-3.0-only

// loc_1131  (ROM 0x1131-0x113b) -- binary->BCD count of B. A=0, C=0, then B iterations of
// `add a,1; daa`; each 0x99->0x00 wrap (daa carry) bumps C. On exit A = (B mod 100) in packed
// BCD and C = the hundreds count. The 0x1133 loop head (djnz target + fall-through from 0x1131)
// is the loop body, not a separate entry, so it is inlined here (no loc_1133.js). No calls.
export function loc_1131(m) {
  const { regs } = m;

  regs.xor(regs.a);  m.step(0x1132, 4); // 1131  xor a -- A = 0
  regs.c = regs.a;   m.step(0x1133, 4); // 1132  ld c,a -- C = 0 (hundreds)

  for (;;) { // loc_1133: BCD-increment A B times; C counts each 99->00 wrap
    regs.add(0x01);  m.step(0x1135, 7);
    regs.daa();      m.step(0x1136, 4);
    if (regs.fNC) {
      m.step(0x1139, 12);                            // 1136  jr nc,0x1139 (no wrap)
    } else {
      m.step(0x1138, 7);
      regs.c = regs.inc8(regs.c);  m.step(0x1139, 4); // 1138  inc c
    }
    if (regs.djnz() !== 0) { m.step(0x1133, 13); continue; } // 1139  djnz 0x1133
    m.step(0x113b, 8);
    break;
  }

  m.ret(); // 113b  ret
}
