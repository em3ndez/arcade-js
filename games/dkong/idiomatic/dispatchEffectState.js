// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchEffectState — the router for the effect-sprite state machine held in EFFECT_STATE.
 *
 * Once per frame it reads EFFECT_STATE and hands the frame to the handler for that state, writing
 * nothing of its own. Pure control flow, a four-way branch on a small enum:
 *
 *   - state 0 — idle. The machine is dormant and nothing happens this frame.
 *   - state 1 — the one-shot: it arms the countdown, spawns the effect sprite and advances the
 *     state to 2.
 *   - state 2 — the countdown. Each frame it works the timer down and, on expiry, tears the effect
 *     down and returns the machine to state 0.
 *   - state 3 — the machine's cold-start address, a defensive slot only. No handler ever writes
 *     state 3, so play never produces it; reaching it would restart the machine, so it is raised
 *     as a loud error instead of taken silently.
 *
 * Because the state byte only ever holds 0, 1 or 2 in play, the three-entry handler table covers
 * every reachable behaviour and every other value falls through to that error. The chosen handler
 * is called directly and whatever it returns is returned unchanged.
 *
 * WHAT THIS NAME DOES NOT CLAIM: what the effect-sprite state machine DEPICTS. The name is taken
 * from the selector cell, and it asserts the router and the selector — not the phenomenon on
 * screen.
 *
 * LIVE-OUT: memory-only, and none of it written here — every visible byte belongs to the handler
 * that ran.
 */
import { EFFECT_STATE } from "./names.js";
import { NotImplemented } from "../../../boards/dkong/io.js";
import { effectStateIdle } from "./effectStateIdle.js";
import { armScorePopupAndSelectAward } from "./armScorePopupAndSelectAward.js";
// The state-2 handler is imported in its address-layer form ON PURPOSE. The two forms are not
// interchangeable here: the address-layer one consumes a guest-stack word that a direct call does
// not, and nothing available to this file can tell the difference either way. An unprovable swap
// is not worth making, so it stays as it is.
import { loc_1e4a } from "../translated/loc_1e4a.js";

// The effect-sprite state machine's handlers, indexed by EFFECT_STATE. Slot 3 is intentionally
// absent — no handler ever produces it, so it and any out-of-range value fall through to the
// error below.
const HANDLERS = [
  effectStateIdle, // state 0 — idle
  armScorePopupAndSelectAward, // state 1 — arm the countdown, spawn the effect sprite, advance to 2
  loc_1e4a, // state 2 — count the timer down, tear the effect down on expiry
];

export function dispatchEffectState(m) {
  const state = m.mem.read8(EFFECT_STATE);
  const handler = HANDLERS[state];
  if (handler) return handler(m);

  // State 3 targets the cold-start address and no state beyond 2 is ever produced; surface it
  // loudly rather than restarting the machine silently.
  throw new NotImplemented(
    `dispatchEffectState: EFFECT_STATE (0x6340) state ${state} has no handler (state 3 is the ROM 0x0000 reset ` +
      `vector; states above 2 do not occur in play).`,
  );
}
