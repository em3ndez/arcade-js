// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandGated } from "./appendSoundCommandGated.js";
/**
 * queueSoundCommand0F — emit sound command 0x0f.
 *
 * WHAT IT IS
 * One of a crowd of tiny sound emitters, each hard-wired to a single command code. This one owns
 * the constant 0x0f: whenever game logic wants that particular sound, it calls here. The whole job
 * is to name the byte and hand it to the machine's one shared sound-enqueue routine.
 *
 * ROLE IN THE MACHINE
 * The audio processor is a separate chip; gameplay code never pokes it directly. Instead, sounds are
 * requested by dropping a one-byte command code into a small circular buffer — the sound-command
 * ring (SOUND_RING_BUFFER, twenty-eight slots at 0x8a43..0x8a5e) — that a once-per-frame drain pays
 * out to the audio side one byte at a time. So a "play this sound" request is really "append this
 * code to the ring". This routine is the producer end for code 0x0f: it supplies the fixed byte and
 * hands it to the shared appender appendSoundCommandGated (ROM 0x0ea2), which does the actual
 * store-into-the-ring-and-advance-the-cursor work. The entry point jumps straight into that appender
 * rather than calling and returning, so the appender's own return carries control back past here to
 * whoever asked for the sound — this routine has no epilogue of its own, and the appender's effect
 * and result stand in for its own.
 *
 * The append is conditional inside appendSoundCommandGated: the byte is queued only while a game is
 * live — the in-play flag GAME_ACTIVE_FLAG (0x8806) set, or the play-state latch PLAY_MODE_LATCH
 * (0x8f50) nonzero. In attract or between lives both gates are closed and the request is silently
 * dropped, so command 0x0f sounds during play but not on the idle screen.
 *
 * ROM 0x0f1d-0x0f20. [seen].
 *
 * LIVE-OUT: A = the advanced ring write cursor left behind by appendSoundCommandGated (or 0 when the
 * gates are closed and no byte is queued). The AF pair is not preserved across the hand-off — unlike
 * BC/DE/HL — so a caller that cares reads this value straight back.
 */

// The one command code this emitter stands for: the byte appended to the sound-command ring
// (SOUND_RING_BUFFER, 0x8a43..0x8a5e) to request sound 0x0f. Fixed at assembly time; the whole
// routine exists only to supply it.
const RING_BYTE = 0x0f; // the fixed byte this wrapper appends

export function queueSoundCommand0F(m) {
  // Hand the fixed code to the shared gated appender. That routine stashes the byte at
  // SOUND_RING_PENDING_BYTE (0x8d20), tests the play gates, and — while a game is live — writes it
  // into the ring slot named by SOUND_RING_WRITE_PTR (0x8a40) and steps that cursor on (wrapping the
  // last slot 0x5e back to the first 0x43). Its result (the advanced cursor, or 0 when suppressed)
  // becomes this routine's result unchanged.
  return appendSoundCommandGated(m, RING_BYTE);
}
