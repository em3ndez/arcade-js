// SPDX-License-Identifier: GPL-3.0-only
import { loc_4195 } from "./names.js";

/**
 * armSubstateAdvanceGate — stamp the "armed" marker into the player-two play sub-state 6 branch gate.
 *
 * WHAT IT IS
 *   The player-two twin of armStateAdvanceGate. It writes the marker value 3 into gate byte loc_4195
 *   (0x4195) and nothing else.
 *
 * ROLE IN THE MACHINE
 *   loc_4195 is the mode flag that the player-two play sub-state 6 handler stepAltPlaySubstate6 tests:
 *   a nonzero value steers it onto its advance-and-show path rather than the shared game-over tail.
 *   The two play phases (runPlayerOnePlayFrame at game-state 3, runPlayerTwoPlayFrame at game-state 4)
 *   keep separate gate cells — 0x41b5 for player one, 0x4195 here for player two — so each player's
 *   sub-state 6 branch is armed independently. The consumer only checks nonzero-ness; the value 3 is
 *   an arbitrary "set" marker.
 *
 * ROM 0x0515.  Grounding: [seen] (names.js cert).
 *
 * LIVE-OUT: memory cell loc_4195 = 3. No registers meaningfully returned.
 */

// The "armed" marker; the sub-state handler stepAltPlaySubstate6 tests loc_4195 only for nonzero-ness.
const ARMED = 3;

export function armSubstateAdvanceGate(m) {
  const { mem8 } = m;
  // Stamp the gate. Writing 3 (any nonzero would do) makes stepAltPlaySubstate6 read the gate as set.
  mem8[loc_4195] = ARMED;
}
