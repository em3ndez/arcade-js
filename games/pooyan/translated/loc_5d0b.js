// SPDX-License-Identifier: GPL-3.0-only

// loc_5d0b  (ROM 0x5d0b-0x5d1d) -- walk the 6-entry stride-0x18 object table at 0x8ae0 calling
// loc_5d1e (animation-hold countdown) on each entry. exx banks the loop counter B and stride DE
// across loc_5d1e; IX is untouched by exx, so add ix,de advances the block pointer each iteration.
export function loc_5d0b(m) {
  const { regs } = m;

  regs.ix = 0x8ae0;              m.step(0x5d0f, 14);
  regs.de = 0x0018;             m.step(0x5d12, 10);
  regs.b = 0x06;                m.step(0x5d14, 7);

  for (;;) { // 5d14: process one object block per iteration
    regs.exx();                 m.step(0x5d15, 4);
    m.push16(0x5d18); m.step(0x5d1e, 17); m.call(0x5d1e); // 5d15  call 0x5d1e
    regs.exx();                 m.step(0x5d19, 4);
    regs.addIx(regs.de);        m.step(0x5d1b, 15); // IX += 0x18
    if (regs.djnz()) { m.step(0x5d14, 13); continue; }
    m.step(0x5d1d, 8);
    break;
  }

  return m.ret(10); // 5d1d  ret
}
