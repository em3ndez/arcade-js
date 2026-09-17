// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchEffectState — router for the effect-sprite state machine in EFFECT_STATE: hand the frame
 * to the handler for state 0/1/2; any other value raises.
 *
 * LIVE-OUT: memory-only, all written by the handler that ran.
 */
import { EFFECT_STATE } from "./names.js";
import { NotImplemented } from "../../../boards/dkong/io.js";
import { effectStateIdle } from "./effectStateIdle.js";
import { armScorePopupAndSelectAward } from "./armScorePopupAndSelectAward.js";
// State-2 handler kept in address-layer form: it consumes a guest-stack word a direct call would
// not, and nothing here can prove the swap safe.
import { loc_1e4a } from "../translated/loc_1e4a.js";

const HANDLERS = [
  effectStateIdle, // state 0 — idle
  armScorePopupAndSelectAward, // state 1 — arm, spawn, advance to 2
  loc_1e4a, // state 2 — count down, tear down on expiry
];

export function dispatchEffectState(m) {
  const { mem8 } = m;
  const state = mem8[EFFECT_STATE];
  const handler = HANDLERS[state];
  if (handler) return handler(m);

  throw new NotImplemented(
    `dispatchEffectState: EFFECT_STATE (0x6340) state ${state} has no handler (state 3 is the ROM 0x0000 reset ` +
      `vector; states above 2 do not occur in play).`,
  );
}
