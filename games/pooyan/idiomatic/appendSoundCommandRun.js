// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandGated } from "./appendSoundCommandGated.js";
/**
 * appendSoundCommandRun — queue a four-byte sound-command RUN into the sound-command ring.
 *
 * WHAT IT IS
 *   One of the "run" producers that feed the machine's sound-command ring buffer. Rather than
 *   latch a sound the instant a game event asks for it, the code accumulates command bytes in a
 *   small circular buffer (28 slots in the 0x8a page) and the frame service pays them out one per
 *   frame to the audio processor. Most producers queue a single command byte; this one queues a
 *   short multi-byte RUN: the caller's own leading command byte, immediately followed by the fixed
 *   three-byte trailer 0x15, 0x16, 0x17.
 *
 * ITS ROLE IN THE MACHINE
 *   The trailer 0x15/0x16/0x17 is the framing/terminator that closes a multi-byte run in the
 *   stream the sound processor reads — it tells the far side "this run is complete." So a caller
 *   that wants a framed run picks its leading byte and hands it here; the fixed tail is appended
 *   for it. Every append goes through the one shared, GATED helper (appendSoundCommandGated), so
 *   the whole run obeys the same play-live gate: while a game is running (GAME_ACTIVE_FLAG set) or
 *   the play-state latch (PLAY_MODE_LATCH) is nonzero the bytes are enqueued, and while the machine
 *   is idle (attract / between lives) they are all dropped. Because the leading byte and the trailer
 *   pass through the identical gate, a run is never split — it is either fully queued or fully
 *   dropped, so the sound processor never sees a truncated, un-terminated run.
 *
 * ROM 0x0fc3-0x0fd4. Grounding tag: [seen].
 *
 * LIVE-OUT: A = the advanced ring write-cursor after the fourth (final) append; 0 when the append
 * gate is closed and the byte was dropped. A survives because the append helper leaves it in the
 * A register (the AF pair is not preserved across these calls, unlike BC/DE/HL) and the caller
 * reads it. It is produced by returning the final append's result.
 */

// The fixed three-byte trailer that terminates a run. Appended in order after the caller's leading
// byte; on the reading side these three bytes frame/close the multi-byte command sequence.
const RUN_BYTE_1 = 0x15;
const RUN_BYTE_2 = 0x16;
const RUN_BYTE_3 = 0x17;

export function appendSoundCommandRun(m, a = m.regs.a) {
  // Append the caller's leading command byte (defaults to the current A) as the head of the run.
  // Through the gated helper, so it — and therefore the whole run — is queued only while play is live.
  appendSoundCommandGated(m, a);
  // Append the first trailer byte (0x15). Same gate as the head: if the head was dropped this is too.
  appendSoundCommandGated(m, RUN_BYTE_1);
  // Append the second trailer byte (0x16).
  appendSoundCommandGated(m, RUN_BYTE_2);
  // Append the final trailer byte (0x17), which terminates the run. This is the tail append: its
  // result — the advanced ring write-cursor (or 0 if the gate is closed) — becomes this routine's A.
  return appendSoundCommandGated(m, RUN_BYTE_3);
}
