// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandGated } from "./appendSoundCommandGated.js";
/**
 * queueSoundCommand13 — emit sound command 0x13 into the sound-command ring.
 *
 * WHAT IT IS
 *   A thin sound emitter. The machine drives its audio processor through a small ring buffer
 *   that lives in the 0x8a00 RAM page: a crowd of tiny routines like this one each carry one
 *   fixed command byte and funnel it into that ring, where the main loop later drains it and
 *   forwards it to the sound processor. This routine's fixed byte is 0x13.
 *
 * ROLE IN THE MACHINE
 *   Command 0x13 is the sound cue fired at the bonus-stage / substate HUD transitions. It is
 *   raised alongside the "BONUS STAGE" intro banner (the banner's audio cue) and when the
 *   substate HUD repaints its BCD digit fields, so the cue accompanies those on-screen
 *   transition moments rather than any in-play game event.
 *
 * ROM ADDRESS: 0x0f44.
 * GROUNDING: [seen].
 *
 * MECHANISM
 *   All the work — the ring write itself and the play-live gate that guards it — lives in the
 *   shared appender. This routine's only job is to pick the command byte (0x13) and hand it to
 *   that shared appender; the appender's exit becomes this routine's exit, so its result flows
 *   straight back to whoever asked for the cue. The append is gated: the byte is only enqueued
 *   while play is live (an in-play game running), and is silently dropped in attract/between
 *   states — so raising this cue outside play is harmless.
 *
 * LIVE-OUT: A = the advanced ring write cursor the append leaves behind (0 when the append's
 *   play-live gates are both closed and nothing was enqueued). Callers read this value back.
 */

// The fixed sound-command byte this emitter carries — command 0x13, the bonus-stage / substate
// HUD transition cue.
const SOUND_CMD = 0x13;

export function queueSoundCommand13(m) {
  // Hand the fixed byte to the shared gated ring appender: it stashes the byte, checks the
  // play-live gate, and (when live) writes it into the ring slot the write cursor points at and
  // advances that cursor. Its return — the advanced cursor, or 0 on a gated drop — is our return.
  return appendSoundCommandGated(m, SOUND_CMD);
}
