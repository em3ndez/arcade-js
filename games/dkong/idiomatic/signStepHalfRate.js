// SPDX-License-Identifier: GPL-3.0-only
/**
 * signStepHalfRate — collapse a direction byte to a ±1 step, every other frame.
 *
 * A leaf in the 50m object subsystem. The caller keeps a signed "direction" byte per moving
 * channel and hands over that byte's address in the pointer register. This routine reduces the
 * byte to a UNIT step in its own sign direction and returns the step — but only on alternate
 * frames:
 *
 *   - On an EVEN frame it returns a step of zero and writes nothing: the channel stands still
 *     this frame.
 *   - On an ODD frame the byte's sign bit decides the step — negative gives -1, anything else
 *     gives +1 — and the step is written back over the byte as well as returned.
 *
 * So the byte is a persistent direction LATCH whose magnitude is thrown away: after the first odd
 * frame it holds only ±1. What the caller publishes therefore pulses 0 / ±1 across frames — a
 * fixed direction delivered at HALF the frame rate. Reversing the direction is somebody else's
 * job; this only reduces to sign.
 *
 * The pointer is left unchanged. A leaf: it reads the frame counter and one byte, and writes at
 * most that byte.
 *
 * LIVE-OUT: memory (the byte, rewritten on odd frames only) plus the step, which the caller
 * consumes immediately.
 */
import { FRAME } from "./names.js";

export function signStepHalfRate(m) {
  const { regs, mem } = m;

  // Even frame: the step is zero and the direction byte is left alone.
  if ((mem.read8(FRAME) & 0x01) === 0) {
    regs.a = 0x00;
    return;
  }

  // Odd frame: the byte's sign becomes a unit step, stored back over it and returned.
  const step = (mem.read8(regs.hl) & 0x80) ? 0xff : 0x01;
  mem.write8(regs.hl, step);
  regs.a = step;
}
