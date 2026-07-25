// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_2407  (ROM 0x2407–0x241E) — FIXED-POINT SUBTRACT. (24 bytes).
 * Spreads packed byte (ix+0x14)=0xHL into HL=(H<<8)|(L<<4), then HL -= BC where
 * BC=(ix+0x12:0x13). Returns HL; writes no memory. Callers: 0x1BDF,0x20C3,0x2146.
 *
 *   2407  dd 7e 14  ld   a,(ix+0x14)
 *   240a  07        rlca                  ) four rotates = nibble swap 0xHL->0xLH
 *   240b  07        rlca                  ) EMIT FOUR EXPLICITLY, do not loop
 *   240c  07        rlca
 *   240d  07        rlca
 *   240e  4f        ld   c,a
 *   240f  e6 0f     and  0x0f
 *   2411  67        ld   h,a              H = original HIGH nibble
 *   2412  79        ld   a,c
 *   2413  e6 f0     and  0xf0             clears carry -> sbc carry-in = 0
 *   2415  6f        ld   l,a              L = original LOW nibble << 4
 *   2416  dd 4e 13  ld   c,(ix+0x13)
 *   2419  dd 46 12  ld   b,(ix+0x12)
 *   241c  ed 42     sbc  hl,bc            HL = HL - BC - 0
 *   241e  c9        ret
 *
 * IX is live-in. sbcHl ASSIGNS this.hl and returns nothing (precedented in sub_236e) --
 * call it BARE.
 */
export function sub_2407(m) {
  const { regs, mem } = m;
  const R = (d) => (regs.ix + d) & 0xffff;

  regs.a = mem.read8(R(0x14)); // packed 0xHL
  m.step(0x240a, 19);
  regs.rlca(); m.step(0x240b, 4);
  regs.rlca(); m.step(0x240c, 4);
  regs.rlca(); m.step(0x240d, 4);
  regs.rlca(); m.step(0x240e, 4); // A = swapped 0xLH; carry dead (masked next)
  regs.c = regs.a;
  m.step(0x240f, 4);
  regs.and(0x0f); // A = 0x0H
  m.step(0x2411, 7);
  regs.h = regs.a; // H = original high nibble
  m.step(0x2412, 4);
  regs.a = regs.c; // A = swapped 0xLH again
  m.step(0x2413, 4);
  regs.and(0xf0); // A = 0xL0 ; AND clears carry -> sbc carry-in is 0
  m.step(0x2415, 7);
  regs.l = regs.a; // L = original low nibble << 4
  m.step(0x2416, 4);
  regs.c = mem.read8(R(0x13));
  m.step(0x2419, 19);
  regs.b = mem.read8(R(0x12));
  m.step(0x241c, 19);
  regs.sbcHl(regs.bc); // HL = HL - BC - carry(=0). BARE call; sbcHl assigns HL.
  m.step(0x241e, 15);
  m.ret(10);
}
