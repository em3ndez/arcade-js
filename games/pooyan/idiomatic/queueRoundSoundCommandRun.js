// SPDX-License-Identifier: GPL-3.0-only
import { ROUND_COUNTER } from "./names.js";
import { appendSoundCommandRun } from "./appendSoundCommandRun.js";
/**
 * queueRoundSoundCommandRun — queue the round-derived sound-command run. A second entry into the
 * sound-command-run trampoline: it picks one of four command bytes from the round counter (bits 1..2 +
 * base, i.e. (v >> 1) & 3) and tail-delegates to the shared sound-command-run appender.
 *
 * LIVE-OUT: memory (the ring append). A carries the appender's advanced cursor out through this
 * tail as a defensive arm — the frozen caller discards A (pop af), so memory carries the contract.
 */

const COMMAND_BASE = 0x1e; // low command byte for round-bits == 0

export function queueRoundSoundCommandRun(m) {
  const command = (((m.mem8[ROUND_COUNTER] >> 1) & 0x03) + COMMAND_BASE) & 0xff;
  return appendSoundCommandRun(m, command);
}
