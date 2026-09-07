// SPDX-License-Identifier: GPL-3.0-only
import { loc_41b5 } from "./names.js";

/**
 * armStateAdvanceGate — stamp the "armed" marker into the play sub-state 6 branch gate.
 *
 * WHAT IT IS
 *   A one-line arming helper. It writes the marker value 3 into gate byte loc_41b5 (0x41b5). It
 *   never reads or branches — it only sets the flag that a later handler consults.
 *
 * ROLE IN THE MACHINE
 *   loc_41b5 is one of the mode flags that the player-one play sub-state 6 handler stepPlaySubstate6
 *   tests: a nonzero value steers that handler onto its advance/proceed path (advance the sub-state and
 *   re-arm the dwell) rather than the shared game-over tail. The concrete marker written is 3, but the
 *   consumer only cares that it is nonzero. This routine is invoked at round launch — beginGameOnStartButton
 *   arms the gate when config bit loc_401f is set — so a configured board proceeds through sub-state 6
 *   instead of dropping back to attract.
 *
 * ROM 0x050f.  Grounding: [seen] (names.js cert).
 *
 * LIVE-OUT: memory cell loc_41b5 = 3. No registers meaningfully returned.
 */

// The "armed" marker; the state handler stepPlaySubstate6 tests loc_41b5 only for nonzero-ness.
const ARMED = 3;

export function armStateAdvanceGate(m) {
  const { mem8 } = m;
  // Stamp the gate. Writing 3 (any nonzero would do) makes stepPlaySubstate6 read the gate as set.
  mem8[loc_41b5] = ARMED;
}
