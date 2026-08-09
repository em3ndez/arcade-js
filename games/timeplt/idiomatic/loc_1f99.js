// SPDX-License-Identifier: GPL-3.0-only
/** loc_1f99 — a stretch of table bytes that decode as instructions rather than a hand-written
 * routine. It churns: a long run of stack words is popped into the flag pair while a few registers
 * are shuffled, the running pointer's own byte is decremented in place, and control finally leaves
 * through whichever computed or off-map address the shuffle produced. Each popped flag pair is what
 * the next branch turns on, so every pop is kept even though only the last before a branch is read.
 * The pointer is pushed once and one cell is decremented, so those are the only bytes it writes.
 * LIVE-OUT: the pushed word and the decremented cell in memory; the transfer it hands control to. */

export function loc_1f99(m) {
  const { regs, mem, mem8 } = m;

  regs.af = m.pop16();
  regs.af = m.pop16();
  regs.c = regs.l;
  regs.af = m.pop16();
  regs.af = m.pop16();
  regs.af = m.pop16();
  m.push16(regs.hl);
  regs.l = regs.dec8(regs.l);
  regs.l = mem8[regs.hl];
  regs.af = m.pop16();
  regs.af = m.pop16();
  regs.e = mem8[regs.hl];
  regs.h = regs.c;
  regs.and(0xf1);
  regs.af = m.pop16();
  regs.af = m.pop16();
  regs.or(regs.d);
  regs.af = m.pop16();
  regs.af = m.pop16();
  regs.af = m.pop16();
  regs.af = m.pop16();
  regs.d = regs.e;
  regs.af = m.pop16();
  regs.af = m.pop16();
  regs.af = m.pop16();
  regs.af = m.pop16();
  regs.sub(regs.l);
  regs.af = m.pop16();
  regs.af = m.pop16();
  regs.af = m.pop16();
  regs.b = regs.l;

  if (regs.fZ) return m.call(0xf1f1);

  regs.af = m.pop16();
  regs.add(0x2c);
  regs.sub(regs.a);
  regs.af = m.pop16();
  regs.af = m.pop16();
  regs.add(regs.c);
  regs.l = regs.c;
  regs.e = 0xf1;
  regs.af = m.pop16();
  regs.cp(regs.h);
  regs.and(regs.c);
  regs.h = regs.b;
  regs.af = m.pop16();
  regs.af = m.pop16();

  // sign-positive: park a return slot and transfer off the map, then resume here
  if (regs.fP) {
    m.push16(0x1fcf);
    m.call(0xf1eb);
  }

  regs.af = m.pop16();
  regs.af = m.pop16();
  regs.af = m.pop16();
  regs.c = regs.b;
  regs.af = m.pop16();
  regs.af = m.pop16();
  regs.af = m.pop16();

  if (regs.fPO) return m.ret();

  regs.h = regs.e;
  regs.decMem8(mem, regs.hl);
  regs.af = m.pop16();
  regs.af = m.pop16();
  regs.xor(regs.d);
  regs.or(regs.h);
  regs.adc(regs.d);
  regs.af = m.pop16();
  regs.af = m.pop16();
  regs.d = regs.c;

  return m.call(regs.hl);
}
