// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandGated } from "./appendSoundCommandGated.js";
/**
 * queueSoundCommand0A — queue sound command 0x0a.
 *
 * Loads the fixed command code and appends it to the command ring through the shared append
 * helper, returning the helper's result unchanged.
 *
 * LIVE-OUT: A = the append helper's advanced ring cursor (0 when the gates are closed); AF is
 * not restored across the tail call, so the caller reads it back.
 */

const COMMAND = 0x0a;

export function queueSoundCommand0A(m) {
  return appendSoundCommandGated(m, COMMAND);
}
