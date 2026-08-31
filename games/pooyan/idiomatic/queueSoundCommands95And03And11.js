// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandGated } from "./appendSoundCommandGated.js";
/**
 * queueSoundCommands95And03And11 — a sound-command selector that emits a fixed
 * three-byte burst (0x95, then 0x03, then 0x11) into the sound-command ring.
 *
 * WHAT IT IS
 *   One of the many thin "selector" routines on the main CPU whose whole job is to name
 *   one or a few fixed command codes and drop them, in order, into the sound-command
 *   ring buffer. This one names three codes and appends them back-to-back.
 *
 * ROLE IN THE MACHINE
 *   The main CPU never synthesizes audio itself. It owns a byte-wide ring of pending
 *   command codes and hands exactly one byte per frame to a separate sound processor
 *   over a hardware latch. Game logic asks for a sound by calling a selector like this
 *   one, which enqueues the command byte(s); the once-per-frame ring drain later pops a
 *   single byte, writes it to the sound-command latch (0xa100), then pulses the audio-IRQ
 *   line (0xa181) high and low to interrupt the sound processor into reading and playing
 *   it. Queuing is therefore decoupled from playback: a three-byte burst enqueued in one
 *   frame is paid out to the sound processor across the following several frames, one
 *   byte per frame.
 *
 * ROM 0x0f30-0x0f3e.
 * Grounding: [seen].
 *
 * Each byte is handed to appendSoundCommandGated, the shared gated tail of every
 * play-only sound emitter. That helper stashes the byte at the pending-byte cell
 * (SOUND_RING_PENDING_BYTE 0x8d20), then appends it to the ring ONLY while play is live —
 * either the in-play gate GAME_ACTIVE_FLAG (0x8806) is set, or the play-state latch
 * PLAY_MODE_LATCH (0x8f50) is nonzero. With both clear (attract, or between lives) each
 * append drops its byte and enqueues nothing. Every byte of the burst re-tests that same
 * gate independently, so the three bytes are queued only during live play and the burst
 * is never left half-queued across a state change.
 *
 * The final append is reached as a tail hand-off: the helper's completion after that last
 * byte returns straight to this routine's caller, so this routine's result IS the helper's
 * result from the third append.
 *
 * LIVE-OUT: A = the ring write cursor (SOUND_RING_WRITE_PTR 0x8a40) as advanced by the
 * final append — the low byte of the slot the next producer will fill — or 0 when the
 * append gates were closed and the last byte was dropped. Callers read it back the same
 * way any append site does.
 */

// The three fixed command codes this selector emits, in order. Each is an opaque cue the
// sound processor interprets; the main CPU only forwards the raw bytes downstream.
const CMD_A = 0x95;
const CMD_B = 0x03;
const CMD_C = 0x11;

export function queueSoundCommands95And03And11(m) {
  // Step 1 — enqueue the first code (0x95). appendSoundCommandGated stashes it at the
  // pending-byte cell (SOUND_RING_PENDING_BYTE 0x8d20), tests the play gate, and — when
  // play is live — writes it into the ring slot named by the write cursor
  // (SOUND_RING_WRITE_PTR 0x8a40, over the ring buffer at 0x8a43) and advances that cursor
  // one slot. The return value is unused here; only the memory effect (a filled slot and
  // the bumped cursor) carries forward to the next append.
  appendSoundCommandGated(m, CMD_A);

  // Step 2 — enqueue the second code (0x03) the same way, into whatever slot the cursor now
  // points at. This append re-tests the gate on its own, so if play just went idle the byte
  // is dropped rather than the burst being partially committed.
  appendSoundCommandGated(m, CMD_B);

  // Step 3 — enqueue the final code (0x11) as the tail hand-off: the helper's completion
  // after this append returns directly to this routine's caller, and its result becomes this
  // routine's result. That value — A holding the advanced write cursor (SOUND_RING_WRITE_PTR
  // 0x8a40), or 0 if the gates were closed and this byte was dropped — is the live-out
  // documented above.
  return appendSoundCommandGated(m, CMD_C);
}
