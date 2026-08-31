// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandGated } from "./appendSoundCommandGated.js";
/**
 * queueSoundCommands95And10 — emit a two-command sound burst: first 0x95, then 0x10.
 *
 * WHAT IT IS
 * A compound sound emitter. Where the tiny single-code emitters each stand for one sound, this one
 * requests a fixed PAIR of command codes back-to-back — 0x95 followed by 0x10 — so a single call
 * from game logic fires both codes into the machine's audio queue in that order.
 *
 * ROLE IN THE MACHINE
 * Gameplay code never pokes the audio processor directly. Sounds are requested by dropping one-byte
 * command codes into a small circular buffer — the sound-command ring (SOUND_RING_BUFFER,
 * 0x8a43..0x8a5e) — that a once-per-frame drain pays out to the audio side one byte at a time. So
 * "play this pair of sounds" is really "append these two codes to the ring, in order". This routine
 * is the producer end for the {0x95, 0x10} pair: it names the two bytes and funnels each through the
 * shared gated appender appendSoundCommandGated (ROM 0x0ea2), which does the store-into-the-ring-and-
 * advance-the-cursor work. Order is preserved because the appends run in sequence, so the drain later
 * pays 0x95 out before 0x10.
 *
 * Each append is CONDITIONAL inside appendSoundCommandGated: a code is queued only while a game is
 * live — the in-play flag GAME_ACTIVE_FLAG (0x8806) set, or the play-state latch PLAY_MODE_LATCH
 * (0x8f50) nonzero. In attract or between lives both gates are closed and BOTH requests are silently
 * dropped, so this burst sounds during play but not on the idle screen.
 *
 * ROM 0x0f21-0x0f2a. [seen].
 *
 * LIVE-OUT: A = the advanced ring write cursor left behind by the SECOND append (or 0 when the gates
 * are closed and nothing was queued). The first append's cursor result is transient — it is
 * overwritten by the second and never observed. The AF pair is not preserved across the appends, so
 * a caller that cares reads this final value straight back.
 */

// The two command codes this emitter fires, in queue order: 0x95 goes into the ring first, 0x10
// second. Both are fixed at assembly time; the whole routine exists only to supply this ordered pair.
const SOUND_CMD_FIRST = 0x95;
const SOUND_CMD_SECOND = 0x10;

export function queueSoundCommands95And10(m) {
  // First append: hand 0x95 to the shared gated appender. It stashes the byte at
  // SOUND_RING_PENDING_BYTE (0x8d20), checks the play gates, and — if a game is live — writes it into
  // the ring slot named by SOUND_RING_WRITE_PTR (0x8a40) and steps that cursor on (wrapping the last
  // slot 0x5e back to the first 0x43). Its returned cursor is discarded here; only the ring write and
  // the advanced cursor-in-memory carry forward to the next append.
  appendSoundCommandGated(m, SOUND_CMD_FIRST);
  // Second append: the same path for 0x10, which lands in the slot the (now-advanced) write pointer
  // names, immediately after 0x95. This is the routine's tail, so the appender's result — the advanced
  // cursor, or 0 when the gates are closed — stands in as this routine's own result unchanged.
  return appendSoundCommandGated(m, SOUND_CMD_SECOND);
}
