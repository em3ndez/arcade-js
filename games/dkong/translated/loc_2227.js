// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_2227  (ROM 0x2227–0x2242) — sub_2207-body state arm: timer RMW at record base+1; on underflow advance state + set 0x621A. HL=record base popped.
 */
export function loc_2227(m) {
  const { regs, mem } = m;
  regs.hl = m.pop16();
  m.step(0x2228, 10); // record base (live-in via 2207)
  regs.l = regs.inc8(regs.l);
  m.step(0x2229, 4); // base+1
  mem.write8(regs.hl, regs.dec8(mem.read8(regs.hl)));
  m.step(0x222a, 11); // dec timer
  if (regs.fZ) {
    m.step(0x222d, 10);
    regs.l = regs.dec8(regs.l);
    m.step(0x222e, 4); // base+0
    mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl)));
    m.step(0x222f, 11); // advance state
    regs.l = regs.inc8(regs.l);
    m.step(0x2230, 4);
    regs.l = regs.inc8(regs.l);
    m.step(0x2231, 4); // base+2
    m.push16(0x2234); m.step(0x2243, 17);
    if (!m.call(0x2243)) return; // MISS -> caller-skip already unwound to loc_197a; do NOT continue/ret
    regs.a = 0x01;
    m.step(0x2236, 7);
    mem.write8(0x621a, regs.a);
    m.step(0x2239, 13);
    m.ret(10);
    return;
  }
  m.step(0x223a, 10);
  regs.l = regs.inc8(regs.l);
  m.step(0x223b, 4); // base+2
  m.push16(0x223e); m.step(0x2243, 17);
  if (!m.call(0x2243)) return; // MISS -> caller-skip already unwound to loc_197a; do NOT continue/ret
  regs.xor(regs.a);
  m.step(0x223f, 4);
  mem.write8(0x621a, regs.a);
  m.step(0x2242, 13);
  m.ret(10);
}
