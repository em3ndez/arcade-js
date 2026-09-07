// SPDX-License-Identifier: GPL-3.0-only
import { tickCascadeCountdown as loc_0331 } from "./tickCascadeCountdown.js";
import { loc_4008, loc_4009 } from "./names.js";

// Reload value written back into the sub-timer when it wraps.
const RELOAD = 60;

/**
 * tickPrescaledSequenceTimer (ROM 0x0336) -- the slow dwell tier of the sequence timer cascade.
 *
 * WHAT IT IS
 *   The sequence state machine walks itself forward on a two/three-tier timer cascade: loc_4008 (0x4008,
 *   the fast sub-timer / prescaler), loc_4009 (0x4009, the dwell tier), and SEQUENCE_STATE (0x400a) just
 *   above it. This routine is the prescaler stage: it decrements loc_4008 every frame and, only when that
 *   wraps, passes a single tick up into the dwell tier -- yielding a dwell whose real period is (reload x
 *   the dwell count), i.e. a slow hold.
 *
 * ROLE IN THE MACHINE
 *   Used by the sequence sub-states that want a long hold (e.g. dwellThenAdvanceSequence). Contrast
 *   tickSequenceDwellTimer, which ticks loc_4009 directly with no prescaler. See mechanisms.md "The
 *   dwell-timer cascade and how it advances the sequence".
 *
 * Grounding: [seen] (names.js ROUTINES 0x0336).
 *
 * LIVE-OUT: memory. Writes loc_4008; on wrap, hands off to tickCascadeCountdown (0x0331) which ticks
 *   loc_4009 and, on its expiry, carries into SEQUENCE_STATE (0x400a).
 */
export function tickPrescaledSequenceTimer(m) {
  const { mem8 } = m;

  // Prescaler tick: count loc_4008 down one, with 8-bit wrap. While it is still counting, this frame is
  // absorbed by the prescaler and the dwell tier does not move.
  const remaining = (mem8[loc_4008] - 1) & 0xff;
  mem8[loc_4008] = remaining;
  if (remaining !== 0) return; // still counting

  // Wrapped: reload the prescaler to 60 and pass one tick up to the dwell tier. tickCascadeCountdown starts
  // at the neighbouring cell loc_4009 and carries its own expiry into SEQUENCE_STATE (0x400a).
  // Wrapped: reload and hand on to the next tier (starting at the neighbouring cell).
  mem8[loc_4008] = RELOAD;
  loc_0331(m, loc_4009);
}
