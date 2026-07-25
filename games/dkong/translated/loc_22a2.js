// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_22a2  (ROM 0x22A2–0x22BC) — sub_2207-body arm: base+4 timer; on 0 counter DOWN, mirror (22bd); at 0x68 reset record to state 0.
 */
export function loc_22a2(m) {
  const { regs, mem } = m;
  regs.hl = m.pop16();
  m.step(0x22a3, 10);
  for (const t of [0x22a4, 0x22a5, 0x22a6, 0x22a7]) { regs.l = regs.inc8(regs.l); m.step(t, 4); } // base+4
  mem.write8(regs.hl, regs.dec8(mem.read8(regs.hl)));
  m.step(0x22a8, 11); // dec timer
  if (regs.fNZ) { m.ret(5); return; }
  m.step(0x22a9, 11);
  mem.write8(regs.hl, 0x02);
  m.step(0x22ab, 10); // reload timer
  regs.l = regs.dec8(regs.l);
  m.step(0x22ac, 4); // base+3
  mem.write8(regs.hl, regs.dec8(mem.read8(regs.hl)));
  m.step(0x22ad, 11); // counter DOWN
  m.push16(0x22b0); m.step(0x22bd, 17); m.call(0x22bd); // display mirror
  regs.a = 0x68;
  m.step(0x22b2, 7);
  regs.cp(mem.read8(regs.hl));
  m.step(0x22b3, 7);
  if (regs.fNZ) { m.ret(5); return; }
  m.step(0x22b4, 11);
  regs.xor(regs.a);
  m.step(0x22b5, 4);
  regs.b = 0x80;
  m.step(0x22b7, 7);
  regs.l = regs.dec8(regs.l);
  m.step(0x22b8, 4); // base+2
  regs.l = regs.dec8(regs.l);
  m.step(0x22b9, 4); // base+1
  mem.write8(regs.hl, regs.b);
  m.step(0x22ba, 7); // (base+1) = 0x80
  regs.l = regs.dec8(regs.l);
  m.step(0x22bb, 4); // base+0
  mem.write8(regs.hl, regs.a);
  m.step(0x22bc, 7); // (base+0) = 0 -- reset to state 0
  m.ret(10);
}
