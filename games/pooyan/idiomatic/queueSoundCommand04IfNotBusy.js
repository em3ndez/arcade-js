// SPDX-License-Identifier: GPL-3.0-only
import { WAVE_TEARDOWN_STATE, GRAB_ACTIVE_FLAG } from "./names.js";
import { appendSoundCommandGated } from "./appendSoundCommandGated.js";
/**
 * queueSoundCommand04IfNotBusy — a state-conditioned producer for the sound subsystem.
 *
 * WHAT IT IS
 *   One of a family of small "selector" routines that each name a fixed sound-effect command byte
 *   and hand it to the sound-command ring buffer. This one owns command byte 0x04. Unlike the plain
 *   selectors, it is guarded: it queues its byte only when the machine is in a quiet enough state,
 *   and otherwise drops the request silently.
 *
 * ROLE IN THE MACHINE
 *   Sound is not latched the instant a game event asks for it. Producers accumulate command bytes in
 *   a small circular buffer in page 0x8a, and the frame service pays out exactly one byte per frame
 *   to the audio processor. This routine is a producer: on its go-path it appends 0x04 to that ring
 *   (through the shared gated appender), which the drain later forwards to the sound hardware.
 *
 *   The two guards keep the 0x04 effect from firing during moments when it would collide with a
 *   higher-priority activity:
 *     - WAVE_TEARDOWN_STATE (0x8f24): nonzero while the enemy formation is being dismantled (state 1
 *       tears the wave down, state 2 walks the boss down the screen). Sound 0x04 is suppressed for
 *       the duration of that sequence.
 *     - GRAB_ACTIVE_FLAG (0x8d32): set to 1 while a rope-grab is in progress. Sound 0x04 is likewise
 *       suppressed until the grab completes.
 *   Only when both guards read zero does the request reach the ring appender — and that appender
 *   applies its own play-live gate on top, so an idle attract screen still drops the byte.
 *
 * ROM 0x0ee3-0x0ef0. [seen].
 *
 * LIVE-OUT: A. The outcome is left in the A accumulator, and the AF pair is not preserved across
 *   this routine (unlike BC/DE/HL). On a busy guard, A holds the nonzero guard byte that caused the
 *   drop; on the go-path, A holds whatever the ring appender returns (the advanced write cursor, or
 *   0 if the appender's own play-live gate rejected the byte). The result is left in A on every
 *   path; a caller that dispatches on the register reads it there.
 */

const APPEND_COMMAND = 0x04;

export function queueSoundCommand04IfNotBusy(m) {
  const { mem8 } = m;

  // Guard 1 — enemy-formation teardown. Read WAVE_TEARDOWN_STATE (0x8f24). While it is nonzero the
  // formation is being dismantled (wave tear-down / boss walk-down), so drop command 0x04 and hand
  // the busy guard byte back in A without touching the ring.
  const teardown = mem8[WAVE_TEARDOWN_STATE];
  if (teardown !== 0) return (m.regs.a = teardown); // wave-teardown busy
  // Guard 2 — rope-grab in progress. Read GRAB_ACTIVE_FLAG (0x8d32). While a grab is active this is
  // nonzero, so command 0x04 is dropped the same way, leaving the guard byte in A.
  const grab = mem8[GRAB_ACTIVE_FLAG];
  if (grab !== 0) return (m.regs.a = grab); // grab busy

  // Go-path — both guards clear. Hand fixed command byte 0x04 to the shared gated ring appender,
  // which stores it into the next sound-command ring slot and advances the write cursor (only while
  // play is live). Its result becomes this routine's A live-out.
  return appendSoundCommandGated(m, APPEND_COMMAND); // tail append
}
