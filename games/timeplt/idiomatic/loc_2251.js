// SPDX-License-Identifier: GPL-3.0-only
/** loc_2251 — a stretch of table bytes decoded as instructions, not a hand-written routine. It is
 * the tamper-trap landing: the caller jumps here when the tile-image readback fails, and executed as
 * code the bytes churn a few registers and then try to store the accumulator through BC. On any
 * realistic entry BC points into non-writable program space, so that first store FAULTS — and if it
 * does not, a hard-coded store further down also lands in non-writable space and faults there. If
 * nothing ever faults the run falls into HALT and burns cycles until the frame budget unwinds it.
 * LIVE-OUT: the write fault the register churn addresses, else a halt; no return. */

export function loc_2251(m) {
  const { regs, mem, mem8 } = m;

  regs.a = regs.inc8(regs.a);
  regs.a = regs.inc8(regs.a);
  regs.a = regs.inc8(regs.a);
  regs.a = regs.inc8(regs.a);
  regs.a = mem8[regs.bc];
  regs.sub(regs.l);
  regs.h = regs.b;
  regs.b = regs.inc8(regs.b);
  regs.sbc(mem8[regs.hl]);
  regs.d = regs.e;
  regs.c = regs.dec8(regs.c);
  regs.adc(regs.e);
  mem8[regs.bc] = regs.a; // usual fault: BC is (B+1,C-1), non-writable

  regs.c = regs.e;
  regs.rrca();
  regs.sub(regs.e);
  regs.d = regs.e;
  regs.rlca();
  regs.xor(regs.c);
  regs.d = regs.h;
  regs.a = mem8[regs.bc];
  regs.sub(mem8[regs.hl]);
  regs.bc = (regs.bc + 1) & 0xffff;
  regs.h = regs.b;
  regs.rrca();
  regs.adc(regs.d);
  regs.hl = (regs.hl + 1) & 0xffff;
  regs.c = regs.b;
  regs.cp(regs.c);
  mem8[regs.bc] = regs.a;
  regs.add(regs.d);
  regs.e = regs.c;
  regs.sbc(regs.a);
  regs.e = regs.c;

  regs.bc = 0x228b;
  regs.xor(regs.e);
  mem8[regs.bc] = regs.a; // non-writable target: the late fault when the first store missed
  regs.c = regs.e;
  mem8[regs.bc] = regs.a;
  regs.adc(regs.e);
  regs.rlca();
  regs.d = regs.l;
  regs.xor(regs.h);
  regs.b = regs.d;

  regs.bc = 0x9050;
  mem8[regs.bc] = regs.a; // unmapped target, not a fault: this store is inert
  regs.d = regs.l;
  regs.decMem8(mem, regs.hl);
  regs.sub(regs.b);
  regs.d = regs.b;
  regs.b = regs.inc8(regs.b);
  regs.sub(regs.d);
  regs.adc(regs.c);
  regs.rra();
  regs.c = regs.b;
  regs.adc(regs.b);
  regs.b = regs.dec8(regs.b);
  regs.adc(regs.h);
  regs.b = regs.d;
  regs.b = regs.dec8(regs.b);
  regs.c = regs.d;
  regs.a = regs.inc8(regs.a);
  regs.c = regs.inc8(regs.c);
  regs.b = mem8[regs.hl];
  regs.add(mem8[regs.hl]);
  regs.a = regs.inc8(regs.a);
  regs.b = regs.inc8(regs.b);
  regs.sub(regs.e);
  regs.e = mem8[regs.hl];
  regs.b = 0x4b;
  regs.addHl(regs.bc);
  regs.c = regs.d;
  regs.a = mem8[regs.bc];
  regs.a = regs.h;
  regs.a = regs.h;
  regs.l = regs.a;
  regs.cp(regs.h);

  regs.bc = 0x078b;
  regs.sub(regs.d);
  regs.c = regs.b;
  regs.rlca();
  regs.adc(regs.b);
  regs.a = regs.h;
  regs.a = regs.h;
  regs.b = regs.l;

  regs.de = 0x5090;
  regs.bc = 0x078b;
  regs.c = regs.e;
  regs.c = regs.inc8(regs.c);
  regs.adc(regs.e);
  regs.a = mem8[regs.bc];

  for (;;) m.step(0x22b8, 4); // halt: burn cycles until the frame budget unwinds
}
