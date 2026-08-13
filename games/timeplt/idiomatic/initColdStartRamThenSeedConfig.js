// SPDX-License-Identifier: GPL-3.0-only
/** initColdStartRamThenSeedConfig — cold-boot init: paint a 64-byte work-RAM block all-ones, then seed the random
 * register, load the default high scores and empty the deferred lists, kicking the watchdog after
 * each, and hand off to the settings/cold-start chain. Control never comes back.
 * LIVE-OUT: the painted block plus whatever the four callees leave; the chain's coroutine handoff. */

import { seedRandomRegister } from "./seedRandomRegister.js";
import { loadDefaultHighScores } from "./loadDefaultHighScores.js";
import { emptyBothDeferredCellLists } from "./emptyBothDeferredCellLists.js";
import { seedGameConfigFromDipSwitches } from "./seedGameConfigFromDipSwitches.js";
import { COMMAND_RING, WATCHDOG_RESET } from "./names.js";

const FILL_BYTES = 64;

export function initColdStartRamThenSeedConfig(m) {
  const { mem8, regs } = m;
  for (let i = 0; i < FILL_BYTES; i++) mem8[COMMAND_RING + i] = 0xff;

  seedRandomRegister(m);
  mem8[WATCHDOG_RESET] = regs.a;
  loadDefaultHighScores(m);
  mem8[WATCHDOG_RESET] = regs.a;
  emptyBothDeferredCellLists(m);
  mem8[WATCHDOG_RESET] = regs.a;

  return seedGameConfigFromDipSwitches(m);
}
