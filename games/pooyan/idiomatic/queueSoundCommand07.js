// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandGated } from "./appendSoundCommandGated.js";
/**
 * queueSoundCommand07 — emit sound command 0x07 into the sound-command ring.
 *
 * WHAT IT IS: one of a crowd of thin, single-purpose sound emitters. Each emitter owns exactly one
 * command byte and exists only to drop that one byte into the shared sound-command ring. This one
 * owns 0x07; its siblings own 0x01, 0x06, 0x0a, 0x0d, 0x0e, 0x0f, 0x11, and so on.
 *
 * ROLE IN THE MACHINE: the audio processor is driven by a small ring buffer that lives in the
 * 0x8a00 page. Gameplay code never pokes that ring directly — instead it calls the named emitter
 * for the effect it wants (this one for command 0x07) and the emitter funnels the byte through the
 * shared ring appender. Once a byte is queued it waits in the ring until the main loop drains one
 * entry per frame and forwards it to the audio processor. Giving each command its own routine means
 * a caller triggers a specific sound just by naming it, with no bare magic number at the call site.
 *
 * ROM 0x0ef9-0x0efc. [seen].
 *
 * HOW THE HARDWARE DOES IT: at 0x0ef9 the accumulator A is loaded with the fixed command 0x07; then
 * 0x0efb jumps straight into the shared appender appendSoundCommandGated (0x0ea2). Because it jumps
 * rather than making a nested call, it lays down no return address of its own — the appender returns
 * directly to whoever invoked this emitter, and the value the appender leaves in A is handed back
 * untouched.
 *
 * WHAT THE APPENDER THEN DOES (context, performed downstream — not here): it stashes the 0x07, then
 * GATES on play being live — it enqueues only while the in-play flag GAME_ACTIVE_FLAG (0x8806) is
 * set or the play-state latch PLAY_MODE_LATCH (0x8f50) is nonzero; in attract or between lives the
 * byte is simply dropped. On the append path it writes 0x07 into the slot the ring write cursor
 * SOUND_RING_WRITE_PTR (0x8a40) points at, then advances that cursor, wrapping the last ring slot
 * back to the first.
 *
 * LIVE-OUT: A = the advanced ring write cursor after the byte is enqueued, or 0 on the gates-closed
 * path where nothing is queued. This routine contributes nothing of its own to that result — it
 * passes the appender's A straight through as its own live-out for a caller that reads it.
 */
const SOUND_CMD = 0x07;

export function queueSoundCommand07(m) {
  // Load the fixed command byte this emitter owns (0x07, from 0x0ef9) and hand it to the shared ring
  // appender. The appender applies the play-live gate and, when the gate is open, drops the byte into
  // the sound-command ring at SOUND_RING_WRITE_PTR (0x8a40) and advances the cursor. Its result in A
  // — the advanced cursor, or 0 when the gate is closed — is the value this routine leaves live.
  return appendSoundCommandGated(m, SOUND_CMD);
}
