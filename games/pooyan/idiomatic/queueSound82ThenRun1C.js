// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandGated } from "./appendSoundCommandGated.js";
import { appendSoundCommandRun } from "./appendSoundCommandRun.js";
/**
 * queueSound82ThenRun1C — a sound-command trampoline.
 *
 * Append the fixed opening tile through the command-ring helper, then tail-hand the run
 * index to the four-byte sound-command run builder, whose result rides straight back out. Both appends
 * are gated inside the helper on the game-active / play-mode state (dropped when idle).
 *
 * LIVE-OUT: A — the advanced ring cursor left by the final append (0 when the gate is closed),
 * set through the tail helper's return-assignment.
 */
const OPEN_TILE = 0x82; // the tile byte emitted first
const RUN_INDEX = 0x1c; // the leading byte of the four-byte sound-command run

export function queueSound82ThenRun1C(m) {
  appendSoundCommandGated(m, OPEN_TILE);
  return appendSoundCommandRun(m, RUN_INDEX);
}
