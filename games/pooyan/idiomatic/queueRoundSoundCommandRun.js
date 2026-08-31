// SPDX-License-Identifier: GPL-3.0-only
import { ROUND_COUNTER } from "./names.js";
import { appendSoundCommandRun } from "./appendSoundCommandRun.js";
/**
 * queueRoundSoundCommandRun — queue the round-derived sound-command RUN.
 *
 * WHAT IT IS
 *   One of a family of tiny selector routines that feed the machine's sound-command ring. Each
 *   selector's whole job is to choose a leading command byte and hand it to the shared run-appender
 *   (appendSoundCommandRun); the appender then queues that byte followed by the fixed three-byte
 *   trailer 0x15/0x16/0x17 that frames — terminates — a multi-byte run in the stream the sound
 *   processor reads. What sets THIS selector apart is that its leading byte is not a constant: it is
 *   derived from the round counter, so the run it queues varies from round to round.
 *
 * ITS ROLE IN THE MACHINE
 *   ROUND_COUNTER (0x8907) advances as the player progresses through rounds. This routine takes two
 *   bits of it — bits 1 and 2, i.e. (counter >> 1) & 3 — to pick one of four leading command bytes,
 *   0x1e through 0x21, and queues the framed run that opens with that byte. Selecting on the middle
 *   bits (rather than bit 0) makes the choice hold for two rounds at a time and repeat with period
 *   eight, so the queued sound steps through its four variants as play advances. Because it routes
 *   through the shared appender, the whole run rides the same play-live gate: while a game is running
 *   (GAME_ACTIVE_FLAG set) or the play-mode latch (PLAY_MODE_LATCH) is nonzero the four bytes are
 *   enqueued, and while the machine is idle they are dropped as a unit — a run is never split.
 *
 * ROM 0x0f97-0x0fa1. Grounding tag: [seen].
 *
 * LIVE-OUT: memory — the four bytes appended to the sound-command ring. The appender also leaves its
 *   advanced ring write-cursor in A and this routine passes that straight through, but the caller
 *   restores its own A immediately after this returns, so A is not a durable result; the ring append
 *   is the contract this routine exists to fulfil.
 */

// The leading command byte for round-bits == 0; the two selected round-counter bits (a value 0..3)
// are added on top, so the four possible leading bytes are 0x1e, 0x1f, 0x20, 0x21.
const COMMAND_BASE = 0x1e;

export function queueRoundSoundCommandRun(m) {
  // Pick the leading command byte from the round counter. Read ROUND_COUNTER (0x8907), keep its bits
  // 1..2 by shifting right one and masking to two bits ((counter >> 1) & 3, giving 0..3), add the
  // 0x1e base, and hold the result to a byte — one of 0x1e/0x1f/0x20/0x21, stepping as rounds pass.
  const command = (((m.mem8[ROUND_COUNTER] >> 1) & 0x03) + COMMAND_BASE) & 0xff;
  // Hand the chosen leading byte to the shared run-appender, which enqueues it plus the fixed
  // 0x15/0x16/0x17 trailer through the play-live gate. This is a tail hand-off: the appender returns
  // directly to this routine's caller, so its result carries out unchanged as noted in LIVE-OUT.
  return appendSoundCommandRun(m, command);
}
