// SPDX-License-Identifier: GPL-3.0-only
/**
 * enterSequenceStep1 -- RST-28 sequence-state handler that advances the state machine into step 1.
 *
 * WHAT IT IS
 *   One handler in the top-level sequence state machine (the second selector, SEQUENCE_STATE 0x400a, that
 *   sits under GAME_STATE within every non-boot phase). It sets the state to 1 and seeds the two-tier
 *   dwell timer that step 1 will count down before it hands the machine on to the next state.
 *
 * ROLE IN THE MACHINE
 *   Galaxian's dwell timers are a cascade: a sub/prescaler tier (loc_4008, 0x4008) feeds a mid/dwell tier
 *   (loc_4009, 0x4009), and the tickCascadeCountdown primitive carries the dwell tier's expiry up into
 *   SEQUENCE_STATE (0x400a) so a step advances the sequence when its dwell runs out. This handler arms
 *   both tiers to a short value of 3, so step 1 is a brief pause before the next advance.
 *
 * ROM 0x0322.  Grounding: [seen]. Cells: SEQUENCE_STATE (0x400a), sub-timer loc_4008 (0x4008), dwell
 * tier loc_4009 (0x4009).
 *
 * LIVE-OUT: mem8 -- SEQUENCE_STATE = 1, loc_4008 = 3, loc_4009 = 3. No register result.
 */
import { SEQUENCE_STATE, loc_4008, loc_4009 } from "./names.js";

// The dwell seeded for step 1: both the sub-timer tier (0x4008) and the dwell tier (0x4009) start at 3.
const DWELL_FRAMES = 3;
const DWELL_TICKS = 3;

export function enterSequenceStep1(m) {
  const { mem8 } = m;

  // Advance the sequence to step 1.
  mem8[SEQUENCE_STATE] = 1;

  // Arm the two-tier dwell the step-1 handler counts down: 0x4008 is the sub/prescaler tier, 0x4009 the
  // dwell tier whose expiry carries up into SEQUENCE_STATE (0x400a) and advances the machine.
  mem8[loc_4008] = DWELL_FRAMES;
  mem8[loc_4009] = DWELL_TICKS;
}
