// SPDX-License-Identifier: GPL-3.0-only
import { tickPrescaledSequenceTimer } from "./tickPrescaledSequenceTimer.js";
import { loc_4019 } from "./names.js";

/**
 * armStepCountdownAndTickSequenceTimer — attract sequence sub-state 1: arm the one-frame countdown
 * cell, then tick the prescaled sequence-dwell timer.
 *
 * WHAT IT IS
 *   Sub-state 1 of runAttractSequenceAndAdvanceOnCredit's SEQUENCE_STATE machine. It does two things
 *   in order: raise countdown cell loc_4019 (0x4019) to 1, then hand off to the shared dwell tick.
 *
 * ROLE IN THE MACHINE
 *   loc_4019 is a downcounter that holdStartLampsThenAdvanceSequence decrements; on its expiry that
 *   handler advances SEQUENCE_STATE and clears the 0x4100 flag block. Setting it to 1 here primes that
 *   one-frame dwell. tickPrescaledSequenceTimer (0x0336) then runs the ordinary sequence-dwell
 *   cascade: it decrements sub-timer 0x4008 each frame, and on wrap reloads 0x4008 to 60 and ticks the
 *   0x4009 dwell tier, advancing SEQUENCE_STATE (0x400a) when that tier expires. So this sub-state both
 *   arms the lamp-hold countdown and keeps the attract sequence's dwell clock running.
 *
 * ROM 0x01be.  Grounding: [seen] (names.js cert).
 *
 * LIVE-OUT: loc_4019 = 1, plus whatever tickPrescaledSequenceTimer mutates (0x4008/0x4009/0x400a).
 */

export function armStepCountdownAndTickSequenceTimer(m) {
  // Arm the dwell flag: holdStartLampsThenAdvanceSequence counts loc_4019 down and advances the state.
  m.mem8[loc_4019] = 1; // arm the dwell flag
  // Tick the prescaled sequence-dwell cascade (0x4008 wrap -> reload 60 -> tick 0x4009 -> SEQUENCE_STATE).
  tickPrescaledSequenceTimer(m);
}
