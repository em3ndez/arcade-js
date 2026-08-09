// SPDX-License-Identifier: GPL-3.0-only
/** loc_2511 — cold-boot init: paint a 64-byte work-RAM block all-ones, then seed the random
 * register, load the default high scores and empty the deferred lists, kicking the watchdog after
 * each, and hand off to the settings/cold-start chain. Control never comes back.
 * LIVE-OUT: the painted block plus whatever the four callees leave; the chain's coroutine handoff. */

import { seedRandomRegister } from "./seedRandomRegister.js";
import { loadDefaultHighScores } from "./loadDefaultHighScores.js";
import { emptyBothDeferredCellLists } from "./emptyBothDeferredCellLists.js";
import { seedGameConfigFromDipSwitches } from "./seedGameConfigFromDipSwitches.js";

const FILL_BASE = 0xac00;
const FILL_BYTES = 64;
const WATCHDOG = 0xc200;

export function loc_2511(m) {
  const { mem8, regs } = m;
  for (let i = 0; i < FILL_BYTES; i++) mem8[FILL_BASE + i] = 0xff;

  seedRandomRegister(m);
  mem8[WATCHDOG] = regs.a;
  loadDefaultHighScores(m);
  mem8[WATCHDOG] = regs.a;
  emptyBothDeferredCellLists(m);
  mem8[WATCHDOG] = regs.a;

  return seedGameConfigFromDipSwitches(m);
}
