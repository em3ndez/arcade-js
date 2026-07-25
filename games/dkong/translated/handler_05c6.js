// SPDX-License-Identifier: GPL-3.0-only
import { NotImplemented } from "../../../boards/dkong/io.js";

/**
 * handler_05c6  (ROM 0x05C6–0x05DF) — task table entry 2: draw a counter.
 *
 *   05c6  fe 03        cp   0x03
 *   05c8  ca e0 05     jp   z,0x05e0
 *   05cb  11 b4 60     ld   de,0x60b4
 *   05ce  a7           and  a
 *   05cf  ca d5 05     jp   z,0x05d5
 *   05d2  11 b7 60     ld   de,0x60b7
 *   05d5  fe 02        cp   0x02
 *   05d7  c2 6b 05     jp   nz,0x056b
 *   05da  11 ba 60     ld   de,0x60ba
 *   05dd  c3 78 05     jp   0x0578
 *
 * Selects which of three BCD counters at 0x60B4 / 0x60B7 / 0x60BA to render
 * from the payload, then tail-jumps to the renderer. Note the `ld de` at
 * 0x05CB is executed and then possibly OVERWRITTEN at 0x05D2 -- the fall
 * through IS the selection, not a mistake.
 */
export function handler_05c6(m) {
  const { regs } = m;

  regs.cp(0x03);
  m.step(0x05c8, 7);
  if (regs.fZ) {
    m.step(0x05e0, 10);
    throw new NotImplemented("handler_05c6 payload 3 path at ROM 0x05E0");
  }
  m.step(0x05cb, 10);
  regs.de = 0x60b4;
  m.step(0x05ce, 10);
  regs.and(regs.a);
  m.step(0x05cf, 4);
  if (regs.fZ) {
    m.step(0x05d5, 10); // jp z -- keep 0x60b4
  } else {
    m.step(0x05d2, 10);
    regs.de = 0x60b7;
    m.step(0x05d5, 10);
  }
  regs.cp(0x02);
  m.step(0x05d7, 7);
  if (regs.fNZ) {
    m.step(0x056b, 10);
    return m.call(0x056b);
  }
  m.step(0x05da, 10);
  return m.call(0x05da);
}
