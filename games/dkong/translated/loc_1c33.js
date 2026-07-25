// SPDX-License-Identifier: GPL-3.0-only

/**
 * loc_1c33  (ROM 0x1C33–0x1C39) — inc a; if wrapped to 0 call 2954; tail-jump 0x1da6.
 */
export function loc_1c33(m) {
  const { regs } = m;
  regs.a = regs.inc8(regs.a);
  m.step(0x1c34, 4); // inc a
  if (regs.fZ) {
    m.push16(0x1c37);
    m.step(0x2954, 17); // call z,0x2954
    m.call(0x2954);
  } else {
    m.step(0x1c37, 10); // call z NOT taken
  }
  m.step(0x1da6, 10); // jp 0x1da6
  return m.call(0x1da6);
}
