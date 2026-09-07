// SPDX-License-Identifier: GPL-3.0-only
// Scale a slope with a random jitter: divide dividend/divisor for the deterministic part, add a bounded
// random draw (0..31) plus a floor of 6, and keep the sum while it stays positive (top bit clear), else
// clamp it to 0x7f. Seeds an object's X velocity.
// The random draw makes each attacker's horizontal speed differ run to run; the +6 floor keeps even a
// zero quotient moving, and the 0x7f clamp caps the magnitude so a signed velocity never flips negative.
import { divideUnsigned8 } from "./divideUnsigned8.js";
import { advanceRandomSeed as loc_003c } from "./advanceRandomSeed.js";

export function computeJitteredXVelocity(m, dividend = m.regs.a, divisor = m.regs.d) {
  // Deterministic part: the quotient of the caller's slope.
  const quotient = divideUnsigned8(m, dividend, divisor);

  // Random jitter: the next PRNG draw, kept to 0..31.
  const jitter = loc_003c(m) & 0x1f;

  // Sum with a floor of 6; keep it if positive, else clamp to 0x7f.
  const sum = (jitter + quotient + 6) & 0xff;
  return (m.regs.a = sum & 0x80 ? 0x7f : sum);
}
