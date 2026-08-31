// SPDX-License-Identifier: GPL-3.0-only
import { queueSoundCommand00 } from "./queueSoundCommand00.js";
import { INTRO_DELAY_CKSUM_WORD, HIT_TALLY, PLAY_STATE_INDEX } from "./names.js";
/**
 * seatPlayReadyOnIntroDelayExpiry — level-intro phase 6, the last one: dwell out the intro delay,
 * then hand the round over to live play. [seen]
 *
 * WHAT IT IS
 *   The final handler of the level-intro phase machine. Each frame the machine sits in this phase
 *   it ticks a short delay counter down; while the delay is still running the routine does nothing
 *   but wait. On the frame the delay reaches zero it performs the intro-to-play handoff: it cuts the
 *   sound channel, zeroes the running target-hit tally, and seats the in-play sub-state at its
 *   play-ready value so that the next frame is a live gameplay frame.
 *
 * ROLE IN THE MACHINE
 *   A round does not jump straight into play. When a level starts, the machine runs a scripted
 *   round-start choreography — the level-intro phase machine — driven by the phase selector
 *   INTRO_PHASE_INDEX (0x8f51), which steps through phases 0..6. Each phase handler builds one stage
 *   of the opening (seat the launch script, run the phase-1 enemy records, draw the target-hit
 *   tally, scale the target-group count, run the phase-5 display toggles) and then advances the
 *   selector to the next phase. By the time this phase runs, the playfield, banner, and tally are
 *   all on screen and there is nothing left to build — only a brief pause before play, and then the
 *   switch over to the gameplay state machine. This handler is that pause and that switch.
 *
 * ROM 0x705f.
 *
 * LIVE-OUT: memory only. It returns no value and leaves nothing useful in a register. On a waiting
 *   frame its only effect is the decremented delay counter; on the expiry frame its effects are the
 *   silence request appended to the sound-command ring, HIT_TALLY cleared to zero, and — the write
 *   that actually ends the intro — PLAY_STATE_INDEX seated to the play-ready sub-state.
 */

// In-play sub-state index seated once the round is ready to run. Value 6 selects the
// reseedSpawnCountersAndArmPlayMode handler in the in-play sub-state machine — the state that
// reseeds the spawn counters and arms the play-mode latch, i.e. the point at which the round is
// primed to run under normal gameplay.
const PLAY_READY_STATE = 0x06;
// Hit tally reset value for the fresh round: a clean zero, so the new round starts counting target
// hits from nothing.
const TALLY_CLEARED = 0x00;

export function seatPlayReadyOnIntroDelayExpiry(m) {
  const { mem8 } = m;

  // Tick the intro-phase delay down, and hold the round in the intro until it drains.
  //   INTRO_DELAY_CKSUM_WORD (0x8f48) is a dual-use cell; in the intro-phase machine it serves as
  //   the intro-phase delay timer, primed by an earlier phase (a value on the order of 0x40). Here
  //   it is used purely as that delay counter. This is a single-byte countdown: subtract one, and
  //   while the byte is still nonzero return at once, so every frame the machine sits in phase 6
  //   burns exactly one count and holds the round in its intro dwell. Only the frame that brings the
  //   count to zero falls through to the handoff below.
  mem8[INTRO_DELAY_CKSUM_WORD] = mem8[INTRO_DELAY_CKSUM_WORD] - 1;
  if (mem8[INTRO_DELAY_CKSUM_WORD] !== 0) return;

  // Delay expired — begin the intro-to-play handoff. First, silence the sound channel.
  //   The intro's audio has run its course and must not bleed into the start of play. This queues
  //   sound command 0x00 — the audio processor's "fall silent" code — by appending it to the
  //   sound-command ring; the per-frame ring drain later forwards it to the audio hardware.
  queueSoundCommand00(m);

  // Clear the running target-hit tally for the new round.
  //   HIT_TALLY (0x8f52) accumulated one per target destroyed over the previous round and was
  //   compared against the target-group count for the end-level bonus (and shown during this intro).
  //   Zero it so the incoming round begins its hit count fresh.
  mem8[HIT_TALLY] = TALLY_CLEARED;

  // Seat the in-play sub-state at its play-ready value — the write that actually ends the intro.
  //   PLAY_STATE_INDEX (0x880a) is the index that drives the round's own in-play sub-state machine.
  //   Storing 6 seats it at the reseed-and-arm state, so the next frame leaves the level-intro path
  //   and runs as live gameplay. With this store the round-start choreography is complete.
  mem8[PLAY_STATE_INDEX] = PLAY_READY_STATE;
}
