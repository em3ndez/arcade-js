// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandGated } from "./appendSoundCommandGated.js";
/**
 * queueSoundCommand12 — emit the fixed sound-command byte 0x12.
 *
 * WHAT IT IS
 *   One of a large family of tiny "sound selector" routines. The main CPU never synthesizes
 *   audio; it only hands one-byte command codes to a separate sound processor. Rather than latch
 *   each sound the instant a game event asks for it, the code accumulates command bytes in a small
 *   circular buffer on page 0x8a — the sound-command ring — and a once-per-frame drain pays them
 *   out one at a time to the audio hardware. Each selector's whole job is to name one fixed
 *   command code and hand it to the shared ring appender. This one names code 0x12.
 *
 * ROLE IN THE MACHINE
 *   A leaf producer for the sound-command ring. Wherever game logic decides that the 0x12 effect
 *   should play, it enters here; the byte lands in the ring and is forwarded to the sound
 *   processor on a later frame drain. It does no state-testing of its own — the game-active /
 *   play-mode gating lives in the shared appender it defers to, so this routine is nothing more
 *   than "the command code is 0x12, go enqueue it".
 *
 * ROM 0x0f3f-0x0f43.
 * GROUNDING: [seen].
 *
 * LIVE-OUT: A = the ring write-cursor the appender leaves after enqueuing (or 0 when the
 *   appender's game-active / play-mode gates are both closed and the byte is dropped). The
 *   routine ends by jumping straight into the appender rather than calling it, so the appender's
 *   exit becomes this routine's exit and its A result flows back to the caller unchanged.
 */

// The single fixed sound-command code this selector emits. The ring carries one interleaved
// stream of such codes regardless of which selector appended a given byte; 0x12 is this one's.
const SOUND_CMD_TEXT = 0x12;

export function queueSoundCommand12(m) {
  // Hand the fixed code 0x12 to the shared gated ring appender: it stashes the byte, checks the
  // game-active flag (0x8806) / play-mode latch (0x8f50), and — only while play is live — writes
  // the byte into the slot at the write cursor SOUND_RING_WRITE_PTR (0x8a40) and advances it,
  // wrapping the last ring slot back to the first. This is the routine's final act (a jump into
  // the appender, not a call), so whatever the appender returns in A is what the caller sees.
  return appendSoundCommandGated(m, SOUND_CMD_TEXT); // tail: the A live-out flows from the appender
}
