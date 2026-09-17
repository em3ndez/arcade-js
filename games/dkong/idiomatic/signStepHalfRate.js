// SPDX-License-Identifier: GPL-3.0-only
/**
 * signStepHalfRate — collapse a signed direction byte (address in the pointer register) to a
 * ±1 step, every other frame. On even frames it returns 0 and writes nothing; on odd frames
 * the byte's sign gives the step (-1 if negative, else +1), written back over the byte and
 * returned. The byte is a persistent direction latch whose magnitude is discarded.
 *
 * LIVE-OUT: memory (the byte, rewritten on odd frames only) plus the returned step.
 */
import { FRAME } from "./names.js";

export function signStepHalfRate(m) {
  const { regs, mem8 } = m;

  if ((mem8[FRAME] & 0x01) === 0) {
    regs.a = 0x00;
    return;
  }

  const step = (mem8[regs.hl] & 0x80) ? 0xff : 0x01;
  mem8[regs.hl] = step;
  regs.a = step;
}
