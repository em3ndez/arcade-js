// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandRun } from "./appendSoundCommandRun.js";
/**
 * queueSoundRun1D — queue the phase-exhausted tile run.
 *
 * Supplies the fixed lead tile code and tail-calls the four-byte sound-command run appender, whose command
 * ring writes (and result) become this routine's.
 *
 * LIVE-OUT: A = the advanced ring cursor left by the tail-call (zero when the append gates are
 * closed); the immediate caller reloads A before reading it, so it is set but not consumed.
 */

const LEAD_TILE = 0x1d; // the run's caller-supplied lead tile

export function queueSoundRun1D(m) {
  return appendSoundCommandRun(m, LEAD_TILE);
}
