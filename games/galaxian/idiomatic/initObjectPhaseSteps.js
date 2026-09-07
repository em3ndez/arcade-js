// SPDX-License-Identifier: GPL-3.0-only
/**
 * initObjectPhaseSteps — object-AI state-13 entry: set up an attacker's phase-step run.
 *
 * WHAT IT IS
 *   The phase-step init state of the diving-attacker AI (object-AI dispatch slot 13;
 *   mechanisms.md "initObjectPhaseSteps (state 13)"). It derives a small step count from the
 *   record's seed byte, records that count and a derived code byte, arms the phase timer, advances
 *   the object's sub-state counter, and clears the ready flag — re-arming the ready flag only when
 *   the step count came out zero.
 *
 * ROLE IN THE MACHINE
 *   The object record is addressed by `obj` (defaulting to the Z80 IX pointer). The step count is
 *   n = (~record[obj+7]) & 3 — the inverted low two bits of the phase seed, i.e. 0..3. The
 *   derived code byte ((n+1)<<4)+140 packs n+1 into the high nibble over a fixed base (an animation
 *   or sprite selector). The ready flag (obj+15) gates the phase from advancing; arming it only for
 *   n==0 means a zero-step object is immediately ready while a multi-step one waits out its steps.
 *
 * ROM 0x109b.  Grounding: [seen].
 *
 * LIVE-OUT: obj+22=n+1; obj+3=((n+1)<<4)+140; obj+16=24; obj+2 incremented; obj+15=0, then =24
 * only when n==0.
 */

// Object-record field offsets.
const PHASE_SEED = 7;   // low 2 bits (inverted) give the step count n
const STEP_COUNT = 22;  // <- n+1
const CODE_BYTE = 3;    // <- (n+1)<<4 + CODE_BASE
const PHASE_TIMER = 16; // <- ARM_VALUE
const SUB_STATE = 2;    // advanced by one
const READY_FLAG = 15;  // cleared, then set to ARM_VALUE only when n==0

const CODE_BASE = 140; // added after shifting n+1 into the high nibble
const ARM_VALUE = 24;  // phase timer, and the ready-flag value when n==0

export function initObjectPhaseSteps(m, obj = m.regs.ix) {
  const { mem8 } = m;

  // Step count n = inverted low two bits of the phase seed (obj+7), giving 0..3.
  const n = ~mem8[obj + PHASE_SEED] & 3;

  // Record n+1 as the step count and the packed code byte, arm the phase timer to 24, advance the
  // sub-state, and clear the ready flag (it is re-armed below only for the zero-step case).
  mem8[obj + STEP_COUNT] = n + 1;
  mem8[obj + CODE_BYTE] = ((n + 1) << 4) + CODE_BASE;
  mem8[obj + PHASE_TIMER] = ARM_VALUE;
  mem8[obj + SUB_STATE] = mem8[obj + SUB_STATE] + 1;
  mem8[obj + READY_FLAG] = 0;

  // n != 0 leaves the ready flag clear; n == 0 arms it.
  if (n !== 0) return;
  mem8[obj + READY_FLAG] = ARM_VALUE;
}
