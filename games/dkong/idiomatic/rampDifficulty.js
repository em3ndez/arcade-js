// SPDX-License-Identifier: GPL-3.0-only
/**
 * rampDifficulty — raise the difficulty value with level and time on the board.
 *
 * Called once per serviced frame. Two nested rate dividers gate the real work so the
 * difficulty value is only recomputed occasionally:
 *
 *   - DIFFICULTY_PRESCALER counts every call; the body proceeds only on the call that
 *     finds it at 0 — once every 256 calls, on the call right after it wraps to zero.
 *   - DIFFICULTY_CLOCK then advances one step on each of those 256-call ticks, and the
 *     recompute fires only on every 8th of those steps — so once per 2048 calls.
 *
 * On that beat DIFFICULTY is recomputed from the current level plus how far the clock
 * has advanced this board, clamped to a maximum of 5:
 *
 *     DIFFICULTY = min(LEVEL + (DIFFICULTY_CLOCK >> 3), 5)
 *
 * so difficulty rises both with the level number and with time spent on the board, and
 * never past 5. Both counters are read BEFORE being stepped, so each divider tests its
 * pre-increment value. The board setup clears the clock, which is why difficulty drops
 * back at the start of every board and then ramps up again.
 *
 * A LEAF: reads and steps DIFFICULTY_PRESCALER and DIFFICULTY_CLOCK, reads LEVEL, writes
 * DIFFICULTY; calls nothing and returns nothing.
 *
 * LIVE-OUT: memory-only — the two counters and DIFFICULTY. The two early returns just mean
 * "skip this frame's work"; no value is handed back on any path.
 */

import { u8 } from "../../../core/int.js";
import { DIFFICULTY_PRESCALER, DIFFICULTY_CLOCK, LEVEL, DIFFICULTY } from "./names.js";

/**
 * @param {object} m  the machine (uses m.mem only).
 * @returns {void}
 */
export function rampDifficulty(m) {
  const { mem } = m;

  // Outer rate divider: step the prescaler every call, but proceed only on the call that
  // finds it at 0 (once per 256 calls, just after it wrapped back to zero). The gate reads
  // the value BEFORE the step, so a 0 here means it wrapped on the previous call.
  const prescaler = mem.read8(DIFFICULTY_PRESCALER);
  mem.write8(DIFFICULTY_PRESCALER, prescaler + 1);
  if (prescaler !== 0) return;

  // Inner rate divider: advance the clock one step on each outer tick, and recompute only
  // on every 8th step — again testing the pre-step value's low 3 bits.
  const clock = mem.read8(DIFFICULTY_CLOCK);
  mem.write8(DIFFICULTY_CLOCK, clock + 1);
  if ((clock & 7) !== 0) return;

  // The clock is a multiple of 8 on this beat, so >> 3 is how many steps it has taken this
  // board. Difficulty is that plus the level, clamped to 5. The sum is taken at byte width
  // because the clamp compares the wrapped value (only reachable with an out-of-range level).
  const ramp = u8(mem.read8(LEVEL) + (clock >> 3));
  mem.write8(DIFFICULTY, ramp < 5 ? ramp : 5);
}
