// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandGated } from "./appendSoundCommandGated.js";
/**
 * queueSoundCommand08 — sound-command emitter for the fixed effect code 0x08.
 *
 * WHAT IT IS
 *   One of the thin sound "selector" routines. Game logic that wants a particular sound never
 *   touches the audio hardware or the command buffer directly; it calls the selector that owns
 *   the wanted code. This one owns effect code 0x08: it names that single fixed byte and hands
 *   it to the shared gated ring appender (appendSoundCommandGated) to be enqueued.
 *
 * ROLE IN THE MACHINE
 *   The main processor does not synthesize audio itself. It accumulates one-byte command codes in
 *   a small circular sound-command ring (SOUND_RING_BUFFER, twenty-eight slots at 0x8a43..0x8a5e)
 *   and pays exactly one code out per frame to a separate sound processor. This routine is a
 *   *producer* on that ring: it deposits the 0x08 code so the once-per-frame drain can later
 *   forward it to the sound side. Because it routes through the gated appender, the byte is only
 *   actually enqueued while play is live — the in-play flag GAME_ACTIVE_FLAG (0x8806) is set, or
 *   the play-mode latch PLAY_MODE_LATCH (0x8f50) is nonzero. Asked for during attract or between
 *   lives, the byte is silently dropped and nothing is queued.
 *
 * ROM 0x0efd. [seen].
 *
 * LIVE-OUT: A = the appender's advanced ring write cursor — the low byte of the next free slot,
 *   which walks 0x43..0x5e and wraps the last slot (0x5e) back to the first (0x43). On the
 *   gates-closed path A = 0 instead. The accumulator carries this value out because it is not
 *   restored on the way back, and callers that chain a further append read it.
 */

// The single fixed effect code this selector owns and enqueues.
const COMMAND_BYTE = 0x08;

export function queueSoundCommand08(m) {
  // Load the fixed effect code 0x08 into the accumulator and fall straight into the shared gated
  // ring appender. That appender stashes the byte at SOUND_RING_PENDING_BYTE (0x8d20), tests the
  // play gate, and — if open — writes the byte into the slot named by the write cursor
  // SOUND_RING_WRITE_PTR (0x8a40), then advances that cursor (0x5e wrapping back to 0x43). The
  // advanced cursor comes back as this routine's own result and is left in the accumulator.
  return (m.regs.a = appendSoundCommandGated(m, COMMAND_BYTE)); // A live-out: advanced ring cursor
}
