// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandGated } from "./appendSoundCommandGated.js";
/**
 * appendSoundCommandRun — append a four-byte sound-command run to the sound-command ring.
 *
 * Appends the caller's byte, then the three fixed bytes that complete the run, each
 * through the shared append helper. The final append is a tail whose result is returned.
 *
 * LIVE-OUT: A = the advanced ring cursor after the fourth append (0 when the append gates
 * are closed). A survives because AF is not restored across the calls and the caller reads
 * it; set through the helper's return-assignment.
 */

const RUN_BYTE_1 = 0x15;
const RUN_BYTE_2 = 0x16;
const RUN_BYTE_3 = 0x17;

export function appendSoundCommandRun(m, a = m.regs.a) {
  appendSoundCommandGated(m, a);
  appendSoundCommandGated(m, RUN_BYTE_1);
  appendSoundCommandGated(m, RUN_BYTE_2);
  return appendSoundCommandGated(m, RUN_BYTE_3);
}
