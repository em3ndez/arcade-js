// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_037f  (ROM 0x037F–0x03A1) — two nested rate dividers; recomputes the difficulty value at 0x6380 from the level, clamped to 5.
 *
 *   037f  21 84 63     ld   hl,0x6384
 *   0382  7e           ld   a,(hl)
 *   0383  34           inc  (hl)
 *   0384  a7           and  a
 *   0385  c0           ret  nz
 *   0386  21 81 63     ld   hl,0x6381
 *   0389  7e           ld   a,(hl)
 *   038a  47           ld   b,a
 *   038b  34           inc  (hl)
 *   038c  e6 07        and  0x07
 *   038e  c0           ret  nz
 *   038f  78           ld   a,b
 *   0390  0f           rrca
 *   0391  0f           rrca
 *   0392  0f           rrca
 *   0393  47           ld   b,a
 *   0394  3a 29 62     ld   a,(0x6229)
 *   0397  80           add  a,b
 *   0398  fe 05        cp   0x05
 *   039a  38 02        jr   c,0x039e
 *   039c  3e 05        ld   a,0x05
 *   039e  32 80 63     ld   (0x6380),a
 *   03a1  c9           ret
 *
 * Two nested rate dividers. 0x6384 counts every call and gates on wrapping to
 * zero (`and a / ret nz` AFTER reading the pre-increment value), then 0x6381
 * gates on every 8th. Only then is the difficulty value at 0x6380 recomputed
 * from the level number, clamped to 5.
 *
 * Note `ld a,(hl)` reads BEFORE `inc (hl)`, so the test is on the old value.
 */
export function loc_037f(m) {
  const { regs, mem } = m;

  regs.hl = 0x6384;
  m.step(0x0382, 10);
  regs.a = mem.read8(regs.hl);
  m.step(0x0383, 7);
  mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl)));
  m.step(0x0384, 11);
  regs.and(regs.a);
  m.step(0x0385, 4);
  if (regs.fNZ) {
    m.ret(11);
    return;
  }
  m.step(0x0386, 5);

  regs.hl = 0x6381;
  m.step(0x0389, 10);
  regs.a = mem.read8(regs.hl);
  m.step(0x038a, 7);
  regs.b = regs.a;
  m.step(0x038b, 4);
  mem.write8(regs.hl, regs.inc8(mem.read8(regs.hl)));
  m.step(0x038c, 11);
  regs.and(0x07);
  m.step(0x038e, 7);
  if (regs.fNZ) {
    m.ret(11);
    return;
  }
  m.step(0x038f, 5);

  regs.a = regs.b;
  m.step(0x0390, 4);
  for (const nxt of [0x0391, 0x0392, 0x0393]) {
    regs.rrca();
    m.step(nxt, 4);
  }
  regs.b = regs.a;
  m.step(0x0394, 4);
  regs.a = mem.read8(0x6229);
  m.step(0x0397, 13);
  regs.add(regs.b);
  m.step(0x0398, 4);
  regs.cp(0x05);
  m.step(0x039a, 7);
  if (regs.fC) {
    m.step(0x039e, 12); // jr c taken
  } else {
    m.step(0x039c, 7);
    regs.a = 0x05;
    m.step(0x039e, 7);
  }
  mem.write8(0x6380, regs.a);
  m.step(0x03a1, 13);
  m.ret();
}
