// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_0965  (ROM 0x0965–0x0976).
 *
 *   0965  11 00 04     ld   de,0x0400
 *   0968  cd 9f 30     call 0x309f
 *   096b  11 14 03     ld   de,0x0314
 *   096e  06 06        ld   b,0x06
 *   0970  cd 9f 30     call 0x309f        ; loop
 *   0973  1c           inc  e
 *   0974  10 fa        djnz 0x0970
 *   0976  c9           ret
 *
 * Queues one task 0x0400, then six consecutive tasks 0x0314..0x0319 -- the
 * payload byte increments while the handler index stays 0x03. So six
 * instances of the same handler, each with a different parameter, which is
 * how the attract screen draws several strings from one routine.
 */
export function loc_0965(m) {
  const { regs } = m;

  regs.de = 0x0400;
  m.step(0x0968, 10);
  m.push16(0x096b);
  m.step(0x309f, 17);
  m.call(0x309f);

  regs.de = 0x0314;
  m.step(0x096e, 10);
  regs.b = 0x06;
  m.step(0x0970, 7);
  do {
    m.push16(0x0973);
    m.step(0x309f, 17);
    m.call(0x309f);
    regs.e = regs.inc8(regs.e);
    m.step(0x0974, 4);
    regs.b = (regs.b - 1) & 0xff; // djnz -- no flags
    m.step(regs.b !== 0 ? 0x0970 : 0x0976, regs.b !== 0 ? 13 : 8);
  } while (regs.b !== 0);

  m.ret();
}
