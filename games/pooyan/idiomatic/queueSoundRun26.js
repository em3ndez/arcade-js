// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandRun } from "./appendSoundCommandRun.js";
/**
 * queueSoundRun26 — queue the four-byte sound-command run that opens with tile code 0x26.
 *
 * Loads the leading tile code and tail-calls the four-byte sound-command run emitter, which appends that
 * byte and the three fixed run tiles into the command ring.
 * LIVE-OUT: A = the advanced ring cursor the emitter leaves (0 when the append gates are
 * closed); the flag/accumulator pair is not restored across the tail, so the caller reads it.
 */

const LEAD_TILE = 0x26; // the run's leading tile code

export function queueSoundRun26(m) {
  return appendSoundCommandRun(m, LEAD_TILE);
}
