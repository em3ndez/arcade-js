// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_241f  (ROM 0x241F–0x2440) — POSITION GATE. (34 bytes). Returns a (D,E) pair.
 * writes NO memory. Callers: 0x1AE6, 0x1BC5, 0x2B09.
 *
 * FIVE conditional rets, ALL fall through when not taken; the (D,E) pair is mutated
 * between them, so the exit reached IS the answer:
 *   X < 0x16                 -> (1,0) default
 *   X >= 0xEA                -> (0,1) far-right edge
 *   bit0(0x6227)==0          -> (0,0) blocked
 *   Y >= 0x58                -> (0,0)
 *   X >= 0x6C                -> (0,0)
 *   else                     -> (1,0)
 * `rrca` is a bit-0 test on (0x6227); A reloaded after, only its carry matters. All cp UNSIGNED.
 */
export function loc_241f(m) {
  const { regs, mem } = m;

  regs.de = 0x0100; // D=1, E=0
  m.step(0x2422, 10);
  regs.a = mem.read8(0x6203); // player X
  m.step(0x2425, 13);
  regs.cp(0x16);
  m.step(0x2427, 5);
  if (regs.fC) {
    m.ret(11); // ret c -- X < 0x16 -> (1,0)
    return;
  }
  m.step(0x2428, 5); // NOT taken

  regs.d = regs.dec8(regs.d); // D=0
  m.step(0x2429, 4);
  regs.e = regs.inc8(regs.e); // E=1 -> (0,1)
  m.step(0x242a, 4);
  regs.cp(0xea);
  m.step(0x242c, 5);
  if (!regs.fC) {
    m.ret(11); // ret nc -- X >= 0xEA -> (0,1)
    return;
  }
  m.step(0x242d, 5);

  regs.e = regs.dec8(regs.e); // E=0 -> (0,0)
  m.step(0x242e, 4);
  regs.a = mem.read8(0x6227); // parity flag
  m.step(0x2431, 13);
  regs.rrca(); // bit 0 -> carry; A now dead (reloaded at 0x2433)
  m.step(0x2432, 4);
  if (!regs.fC) {
    m.ret(11); // ret nc -- bit0 clear -> (0,0)
    return;
  }
  m.step(0x2433, 5);

  regs.a = mem.read8(0x6205); // player Y
  m.step(0x2436, 13);
  regs.cp(0x58);
  m.step(0x2438, 5);
  if (!regs.fC) {
    m.ret(11); // ret nc -- Y >= 0x58 -> (0,0)
    return;
  }
  m.step(0x2439, 5);

  regs.a = mem.read8(0x6203); // player X again
  m.step(0x243c, 13);
  regs.cp(0x6c);
  m.step(0x243e, 5);
  if (!regs.fC) {
    m.ret(11); // ret nc -- X >= 0x6C -> (0,0)
    return;
  }
  m.step(0x243f, 5);

  regs.d = regs.inc8(regs.d); // D=1 -> (1,0)
  m.step(0x2440, 4);
  m.ret(10);
}
