// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandGated } from "./appendSoundCommandGated.js";
/**
 * queueSoundCommand11 — request sound cue 0x11 by dropping its command byte into the sound ring.
 *
 * ROM 0x0f2b-0x0f2f. [seen].
 *
 * WHAT IT IS
 *   One member of a small family of near-identical sound emitters (queueSoundCommand01 / 06 / 0A /
 *   0D / 0E / 0F / 11, ...). Each emitter stands for exactly one entry in the game's sound
 *   vocabulary: it carries a single fixed command code and does nothing but hand that code to the
 *   shared ring appender. This one carries code 0x11.
 *
 * ITS ROLE IN THE MACHINE
 *   Audio is decoupled from the code that wants a sound: rather than poke the audio processor
 *   directly, gameplay code calls an emitter like this one, which merely ENQUEUES the cue into the
 *   sound-command ring buffer on the 0x8a00 page. The sound is not produced here and not produced
 *   now — later, the main loop drains one byte per frame from that ring and forwards it to the audio
 *   processor (unless the machine is meant to be silent). So calling this routine is a request —
 *   "play cue 0x11 soon" — not the act of playing it.
 *
 *   The enqueue is also GATED downstream: the shared appender only admits the byte while play is
 *   actually live (the in-play flag set, or the play-state latch nonzero); during attract or between
 *   lives the cue is dropped. This routine itself carries no logic beyond the fixed code — all of the
 *   ring mechanics and the gate live in the appender it defers to.
 *
 * LIVE-OUT
 *   A = the sound ring's advanced write cursor as the appender leaves it (0 when the play gate is
 *   closed and nothing was enqueued). Whatever the appender leaves in A is exactly what this routine
 *   yields, since it does no work of its own after handing off.
 */
const COMMAND_BYTE = 0x11; // the fixed sound-cue code this emitter stands for

export function queueSoundCommand11(m) {
  // Supply the one constant this emitter owns — cue code 0x11 — and hand straight off to the shared
  // gated ring appender (ROM 0x0ea2). That appender stashes the byte, checks the play gate, and on
  // the live path writes it into the ring slot under the write cursor (SOUND_RING_WRITE_PTR, 0x8a40)
  // then advances and wraps the cursor. Control returns from there directly to our own caller, so the
  // appender's result — the advanced cursor left in A — becomes this routine's result unchanged.
  return appendSoundCommandGated(m, COMMAND_BYTE);
}
