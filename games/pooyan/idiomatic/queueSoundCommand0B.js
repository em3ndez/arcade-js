// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandGated } from "./appendSoundCommandGated.js";
/**
 * queueSoundCommand0B — append the fixed command byte 0x0b into the page-0x8a command ring. A one-line
 * wrapper: it selects byte 0x0b and hands it to the ring-append helper.
 *
 * LIVE-OUT: A = the advanced ring cursor the helper leaves in the accumulator (0 on the
 * gates-closed path); callers read it, propagated via the helper's return-assignment.
 */

const COMMAND_BYTE = 0x0b; // the command byte this wrapper appends

export function queueSoundCommand0B(m) {
  return appendSoundCommandGated(m, COMMAND_BYTE);
}
