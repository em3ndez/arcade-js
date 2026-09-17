// SPDX-License-Identifier: GPL-3.0-only
/**
 * rampDifficulty — raise the difficulty value with level and time on the board, throttled by two
 * nested rate dividers so it recomputes once per 2048 calls:
 *
 *     DIFFICULTY = min(LEVEL + (DIFFICULTY_CLOCK >> 3), 5)
 *
 * Both counters are read before being stepped, so each divider tests its pre-increment value.
 *
 * LIVE-OUT: memory-only — the two counters and DIFFICULTY.
 */

import { u8 } from "../../../core/int.js";
import { DIFFICULTY_PRESCALER, DIFFICULTY_CLOCK, LEVEL, DIFFICULTY } from "./names.js";

export function rampDifficulty(m) {
  const { mem8 } = m;

  // Outer divider: proceed only on the call that finds the prescaler at 0 (once per 256 calls).
  const prescaler = mem8[DIFFICULTY_PRESCALER];
  mem8[DIFFICULTY_PRESCALER] = prescaler + 1;
  if (prescaler !== 0) return;

  // Inner divider: advance the clock each outer tick, recompute only on every 8th step.
  const clock = mem8[DIFFICULTY_CLOCK];
  mem8[DIFFICULTY_CLOCK] = clock + 1;
  if ((clock & 7) !== 0) return;

  // >> 3 is how many steps the clock has taken this board; plus the level, clamped to 5. The sum
  // is taken at byte width because the clamp compares the wrapped value.
  const ramp = u8(mem8[LEVEL] + (clock >> 3));
  mem8[DIFFICULTY] = ramp < 5 ? ramp : 5;
}
