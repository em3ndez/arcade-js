// SPDX-License-Identifier: GPL-3.0-only

/**
 * sub_0057  (ROM 0x0057–0x0065) — stirs the pseudo-random seed at 0x6018 from the two frame counters.
 *
 *   0057  3a 18 60     ld   a,(0x6018)
 *   005a  21 1a 60     ld   hl,0x601a
 *   005d  86           add  a,(hl)
 *   005e  21 19 60     ld   hl,0x6019
 *   0061  86           add  a,(hl)
 *   0062  32 18 60     ld   (0x6018),a
 *   0065  c9           ret
 *
 * Accumulates the two frame counters into 0x6018 -- a cheap pseudo-random
 * seed, stirred once per vblank from values that advance at different rates
 * (0x601A decremented by the NMI, 0x6019 incremented by the main loop).
 */
export function sub_0057(m) {
  const { regs, mem } = m;
  regs.a = mem.read8(0x6018);
  m.step(0x005a, 13);
  regs.hl = 0x601a;
  m.step(0x005d, 10);
  regs.add(mem.read8(regs.hl));
  m.step(0x005e, 7);
  regs.hl = 0x6019;
  m.step(0x0061, 10);
  regs.add(mem.read8(regs.hl));
  m.step(0x0062, 7);
  mem.write8(0x6018, regs.a);
  m.step(0x0065, 13);
  m.ret();
}
