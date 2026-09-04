// SPDX-License-Identifier: GPL-3.0-only

/**
 * normalizeUpBySteps — lift a below-range value up into range in 0x10 steps, counting the steps.
 *
 * WHAT IT IS
 *   A tiny normalizer: while the value is "negative" (its sign bit, 0x80, is set), it keeps adding
 *   0x10 (one grid step of 16 pixels) and bumping a step counter, stopping the moment the value goes
 *   non-negative. So it slides a value up by whole 16-pixel grid steps until it lands in the 0x00-0x7f
 *   range, and reports how many steps that took.
 *
 * ROLE IN THE MACHINE
 *   The coordinate-scaling primitive countStepsToThreshold (0x1554) calls this when its coordinate A
 *   starts below range (negative), so the subsequent step-counting begins from a normalized base.
 *   countStepsToThreshold in turn backs scaleXToBlock / scaleYToBlock — the screen-to-grid mappings —
 *   so this feeds the pixel-coordinate-to-block-index math. The step count accumulates in C, matching
 *   the step count those scalers report.
 *
 * ROM 0x1590-0x1596.  Grounding: [seen].
 * LIVE-OUT: A = the normalized (now non-negative) value, C = the number of 0x10 steps applied.
 */
// Normalize the value up into range: add a step (counting each) until it is no longer negative.
export function normalizeUpBySteps(m, value = m.regs.a, steps = m.regs.c) {
  // One pass per 16-pixel step: count the step, add 0x10, and repeat while the sign bit is still set
  // (value & 0x80). The 8-bit wrap on both accumulators mirrors the 8080's inr c / adi 0x10.
  do {
    steps = (steps + 1) & 0xff;
    value = (value + 0x10) & 0xff;
  } while (value & 0x80);
  // Publish the normalized value in A and the step tally in C for countStepsToThreshold to continue.
  return [(m.regs.a = value), (m.regs.c = steps)];
}
