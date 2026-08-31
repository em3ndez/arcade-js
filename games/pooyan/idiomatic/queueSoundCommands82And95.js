// SPDX-License-Identifier: GPL-3.0-only
import { enqueueSoundCommandRing } from "./enqueueSoundCommandRing.js";
/**
 * queueSoundCommands82And95 — a sound-command emitter: enqueue two fixed command bytes,
 * 0x82 then 0x95, onto the sound-command queue, in that order.
 *
 * WHAT IT IS
 * One of a large family of small "selector" routines, each of which names one or a few fixed
 * command codes and hands them to the audio subsystem. This one names exactly two (0x82, then
 * 0x95) and appends them back-to-back, so together they read as a single short cue.
 *
 * ROLE IN THE MACHINE
 * The main CPU never produces sound itself. It posts requests to a separate audio processor
 * through a small circular queue (a ring buffer) in shared work RAM, and a once-per-frame drain
 * pays those requests out to the audio processor one byte per frame. This routine is a *producer*
 * for that queue: it drops two command codes in and returns, leaving the actual sound-making to
 * the audio side, which reads and interprets 0x82 and 0x95 on its own. The main CPU only chooses
 * *which* codes to enqueue and in *what order*; it attaches no meaning to the bytes beyond that.
 *
 * It is called at board/phase setup moments — when the board-intro is built, and when the
 * gameplay-state handler resets the phase — so this pair is queued as one cue at those points.
 *
 * ROM 0x0f4e-0x0f57.
 * Grounding: [seen].
 *
 * ORDER AND FRAMING
 * The two bytes are appended in sequence (0x82 first), and the queue is first-in-first-out, so the
 * audio processor will receive 0x82 before 0x95 — the ordering is the message. In the machine the
 * second append is reached by a jump rather than a subroutine call, so the append's return goes
 * straight back to this routine's own caller; that changes nothing observable — both codes are
 * still enqueued in order.
 *
 * UNCONDITIONAL PATH
 * Both bytes go through the plain (ungated) enqueue helper, not the play-gated one, so neither is
 * ever dropped: this cue is queued regardless of whether a game is running or the machine is in
 * attract/demo mode. (Some other emitters use a gated append that discards its bytes while no game
 * is active; this one does not.)
 *
 * LIVE-OUT: memory only — the two newly-filled ring slots and the write pointer advanced twice.
 * The enqueue helper leaves the advanced pointer in a register, but every enqueue site reloads it
 * before use, so no register survives this routine.
 */

// The two fixed command codes this emitter posts, in enqueue order. Their meaning is defined by
// the audio processor that consumes the queue, not here; the main CPU only names and orders them.
const CMD_FIRST = 0x82; // queued first
const CMD_SECOND = 0x95; // queued second, immediately after

export function queueSoundCommands82And95(m) {
  // Append the first code (0x82) to the tail of the sound-command ring and advance the write
  // pointer. The plain helper is unconditional, so this always lands in the queue.
  enqueueSoundCommandRing(m, CMD_FIRST);
  // Append the second code (0x95) right behind it, advancing the write pointer again. Because the
  // queue is FIFO, the audio processor will see 0x82 then 0x95, preserving the cue's order.
  enqueueSoundCommandRing(m, CMD_SECOND);
}
