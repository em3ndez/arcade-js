// SPDX-License-Identifier: GPL-3.0-only
import { SIREN_ENABLE_GATE, ROUND_COUNTER } from "./names.js";
import { appendSoundCommandGated } from "./appendSoundCommandGated.js";
import { appendSoundCommandRun } from "./appendSoundCommandRun.js";
/**
 * queueSirenSoundRun — queue the warning-siren's sound-command run, but only while the
 * siren-enable gate is clear.
 *
 * WHAT IT IS
 *   One of the machine's sound producers. It feeds the sound-command ring buffer that lives in the
 *   0x8a page: instead of poking the audio processor directly, the game accumulates command bytes in
 *   a small circular buffer and the frame service pays them out one per frame. This particular
 *   producer emits the WARNING SIREN — the periodic audio cue that plays during a wave. It picks the
 *   siren's command byte for the current round, drops it into the ring, and then appends the fixed
 *   terminator run that closes a multi-byte sound sequence.
 *
 * ITS ROLE IN THE MACHINE
 *   The siren is owned by two different pieces depending on the state of the siren-enable gate
 *   SIREN_ENABLE_GATE (0x8d68). While that gate is NONZERO the idle-siren ticker
 *   (tickIdleSirenAndTogglePhase) drives the siren on its own frame countdown, so this producer must
 *   stand down and emit nothing. Only while the gate is CLEAR (zero) does this routine speak,
 *   queueing the siren run itself. That is why the very first thing it does is read the gate and bail
 *   out when it is set.
 *
 *   Which of two siren command bytes it queues is selected by the parity of the round counter
 *   ROUND_COUNTER (0x8907): its low bit picks between the base command 0x1a and the next one up, so
 *   odd and even rounds sound the alternate siren variant. It is a sibling of queueRoundSoundCommandRun
 *   (0x0f97), which does the same "pick a command from a round-counter-derived index, then append the
 *   fixed run" for a different cue.
 *
 * ROM 0x0f76-0x0f87. Grounding tag: [seen].
 *
 * LIVE-OUT: A.
 *   - Gate-set (siren disabled) path: A = the gate byte itself, which is nonzero here — the caller
 *     gets back the reason nothing was queued.
 *   - Gate-clear (queue) path: A = the advanced ring write-cursor left by the final append in the run
 *     chain — or 0 when the ring's own play-live gate was closed and the bytes were dropped. It is
 *     produced by returning the run helper's result.
 */

const DRAW_TILE_BASE = 0x1a; // base siren sound-command byte; the round counter's low bit picks this variant or the next one up

export function queueSirenSoundRun(m) {
  const { mem8 } = m;
  // Read the siren-enable gate SIREN_ENABLE_GATE (0x8d68). It decides who owns the siren this frame:
  // nonzero means the idle-siren ticker is driving it, so this producer keeps quiet.
  const gate = mem8[SIREN_ENABLE_GATE];
  // Gate set → the siren is being handled elsewhere. Queue nothing and hand the (nonzero) gate byte
  // back in A so the caller can see the disabled state.
  if (gate !== 0) return (m.regs.a = gate); // siren disabled: nothing to queue

  // Gate clear → this producer owns the siren. Choose the siren command byte for the current round:
  // base command 0x1a plus the low bit of the round counter ROUND_COUNTER (0x8907), so odd/even
  // rounds alternate between the two siren variants (0x1a / 0x1b).
  const tile = DRAW_TILE_BASE + (mem8[ROUND_COUNTER] & 0x01);
  // Drop the chosen siren command byte into the sound-command ring through the shared gated appender,
  // so it is enqueued only while play is live. The append leaves the advanced ring cursor in A, which
  // is carried straight into the run helper below as that run's leading byte.
  appendSoundCommandGated(m, tile); // append the siren command; the append leaves the advanced cursor in A
  // Append the fixed terminator run (leading byte + 0x15/0x16/0x17) that frames and closes the
  // multi-byte sound sequence for the audio processor. Its result — the advanced ring cursor, or 0 if
  // the ring's play-live gate dropped the bytes — becomes this routine's live-out A.
  return appendSoundCommandRun(m); // append the completing run; A = the final cursor
}
