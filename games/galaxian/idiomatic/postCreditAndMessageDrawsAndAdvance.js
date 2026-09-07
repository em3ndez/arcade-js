// SPDX-License-Identifier: GPL-3.0-only
/**
 * postCreditAndMessageDrawsAndAdvance -- one step of the attract-mode sequence state machine that
 * paints the credit HUD and a line of message text, then hands the sequence on to its next step.
 *
 * WHAT IT IS
 *   The top-level state machine runs a long scripted attract show (~19 sub-states) that walks itself
 *   forward on a dwell-timer cascade. This is one of those steps: it does not draw anything inline --
 *   it appends two deferred draw requests to the command queue, bumps the sequence index, and re-arms
 *   the dwell timer so the machine holds on the next step for a fixed number of frames before ticking on.
 *
 * ROLE IN THE MACHINE
 *   Dispatched by SEQUENCE_STATE (0x400a) during attract, alongside the other title/message-emitting
 *   steps. Handlers here rarely touch VRAM or the sound hardware directly; instead they hand
 *   channel/parameter words to enqueueCommandWord, and a per-frame consumer (decodeDisplayListSlotAndDispatch)
 *   later drains the queue and vectors each word to the real draw handler. A command word is
 *   (channel << 8) | parameter.
 *
 * ROM 0x02d1.  Grounding: [seen] (names.js ROUTINES cert).
 *
 * LIVE-OUT: memory only -- SEQUENCE_STATE incremented, dwell tiers loc_4008/loc_4009 re-armed, and two
 *   entries pushed onto the command queue. No register result the caller reads.
 */
import { enqueueCommandWord } from "./enqueueCommandWord.js";
import { SEQUENCE_STATE, loc_4008, loc_4009 } from "./names.js";

export function postCreditAndMessageDrawsAndAdvance(m) {
  const { mem8 } = m;

  // Queue the credit-count HUD redraw: word 0x0701 is channel 7 (the credit/score display) with arg 1.
  enqueueCommandWord(m, (7 << 8) | 1);
  // Queue the message-column draw: word 0x0600 is channel 6 (the message text) with arg 0.
  enqueueCommandWord(m, 6 << 8);

  // Advance to the next sub-state. A byte increment on SEQUENCE_STATE steps the attract show forward;
  // the actual dwell before the next step runs is governed by the two-tier timer re-armed just below.
  mem8[SEQUENCE_STATE]++;
  mem8[loc_4008] = 96; // dwell sub-timer
  mem8[loc_4009] = 16; // dwell tier
}
