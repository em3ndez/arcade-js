// SPDX-License-Identifier: GPL-3.0-only
/**
 * presetCreditCount -- the config-mode-3 branch of the coin/credit service: force the machine to nine
 * credits and clear the coin-phase flag.
 *
 * WHAT IT IS
 *   The per-frame coin/credit front-end serviceCoinInputs (0x18ef) forks on the operator coinage
 *   config in loc_4000. When that config reads 3 (a free-play / service setting), the normal coin-edge
 *   accounting is skipped entirely and this routine runs instead: it simply pins the credit count so a
 *   game can always be started without inserting a coin.
 *
 * ROLE IN THE MACHINE
 *   Reached only from serviceCoinInputs' loc_4000 == 3 branch. loc_4002 is the credit count (the same
 *   cell the attract loop tests to hand off to press-start); loc_4001 is the coin-phase flag used by
 *   the two-coins-per-credit path. Presetting to 9 credits and clearing the phase flag together put the
 *   machine in a known "credits available" state every frame this mode is selected.
 *
 * ROM 0x1917.  Grounding: [seen] (names.js ROUTINES cert).
 *
 * LIVE-OUT: memory only -- loc_4001 (coin-phase flag) cleared, loc_4002 (credit count) forced to 9.
 */
import { loc_4001, loc_4002 } from "./names.js";

// The two write values: the coin-phase flag is cleared, the credit count is forced to 9. Named as
// constants because the two bytes are written independently rather than as one 16-bit store.
const LOW_RESET = 0;
const HIGH_RESET = 9;

export function presetCreditCount(m) {
  const { mem8 } = m;
  // Clear the coin-phase flag (loc_4001): no partial coin is pending in free-play mode.
  mem8[loc_4001] = LOW_RESET;
  // Force the credit count (loc_4002) to 9 so a game can always be started.
  mem8[loc_4002] = HIGH_RESET;
}
