// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchCreditedSubstate — run the current step of the credited game (the stretch after a
 * coin is accepted, before play begins): hand the frame to the handler for the sub-state.
 *
 * LIVE-OUT: memory-only — whatever the dispatched step writes.
 */

import { GAME_SUBSTATE } from "./names.js";
import { NotImplemented } from "../../../boards/dkong/io.js";
import { enterCreditScreen } from "./enterCreditScreen.js";
import { commitGameStart } from "./commitGameStart.js";

const HANDLERS = [
  enterCreditScreen, // sub-state 0 — wipe the playfield, set up the credit / start-select screen
  commitGameStart, // sub-state 1 — idle wait-for-start, then commit the game when start is pressed
];

export function dispatchCreditedSubstate(m) {
  const handler = HANDLERS[m.mem8[GAME_SUBSTATE]];
  if (handler) return handler(m);

  throw new NotImplemented(
    `dispatchCreditedSubstate: GAME_SUBSTATE ${m.mem8[GAME_SUBSTATE]} has no credited-state handler (only 0 and 1 occur).`,
  );
}
