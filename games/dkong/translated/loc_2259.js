// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2259  (ROM 0x2259–0x2298) — sub_2207-body arm: base+4 timer; on 0 reload + bump base+3 counter, mirror (22bd), at 0x78 advance state; player-Y descend logic.
 */
export function loc_2259(m) {
  const { regs, mem } = m;
  regs.hl = m.pop16();
  m.step(0x225a, 10);
  for (const t of [0x225b, 0x225c, 0x225d, 0x225e]) { regs.l = regs.inc8(regs.l); m.step(t, 4); } // base+4
  mem.write8(regs.hl, regs.dec8(mem.read8(regs.hl)));
  m.step(0x225f, 11); // dec timer
  if (regs.fNZ) { m.ret(5); return; }
  m.step(0x2260, 11);
  regs.a = 0x04;
  m.step(0x2262, 7);
  mem.write8(regs.hl, regs.a);
  m.step(0x2263, 7); // reload timer
  regs.l = regs.dec8(regs.l);
  m.step(0x2264, 4); // base+3
  mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl)));
  m.step(0x2265, 11); // bump counter
  m.push16(0x2268); m.step(0x22bd, 17); m.call(0x22bd); // display mirror
  regs.a = 0x78;
  m.step(0x226a, 7);
  regs.cp(mem.read8(regs.hl));
  m.step(0x226b, 7);
  if (regs.fZ) {
    m.step(0x226e, 10);
    for (const t of [0x226f, 0x2270, 0x2271]) { regs.l = regs.dec8(regs.l); m.step(t, 4); } // base+0
    mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl)));
    m.step(0x2272, 11); // advance state
    for (const t of [0x2273, 0x2274, 0x2275]) { regs.l = regs.inc8(regs.l); m.step(t, 4); } // base+3
  } else {
    m.step(0x2275, 10);
  }
  regs.l = regs.dec8(regs.l);
  m.step(0x2276, 4); // base+2
  m.push16(0x2279); m.step(0x2243, 17);
  if (!m.call(0x2243)) return; // MISS -> caller-skip already unwound to loc_197a; do NOT continue/ret
  regs.a = mem.read8(0x6205);
  m.step(0x227c, 13); // player Y
  regs.cp(0x68);
  m.step(0x227e, 7);
  if (regs.fC) return m.call(0x2284); // Y < 0x68
  m.step(0x228a, 10);
  regs.rra();
  m.step(0x228b, 4);
  if (regs.fC) { m.step(0x2281, 10); return m.call(0x2284); } // Y odd
  m.step(0x228e, 10);
  regs.rra();
  m.step(0x228f, 4);
  regs.a = 0x01;
  m.step(0x2291, 7);
  if (!regs.fC) {
    regs.xor(regs.a);
    m.step(0x2295, 4);
  } else {
    m.step(0x2295, 10);
  }
  mem.write8(0x6222, regs.a);
  m.step(0x2298, 13);
  m.ret(10);
}
