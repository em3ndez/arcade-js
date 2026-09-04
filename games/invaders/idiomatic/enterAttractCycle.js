// SPDX-License-Identifier: GPL-3.0-only
import { runAttractCycle } from "./runAttractCycle.js";
import { loc_20cf } from "./names.js";

/**
 * enterAttractCycle — the join point at the top of the attract loop.
 *
 * WHAT IT IS
 *   The entry that seeds one attract round's mode state and then runs the attract setup + free-running
 *   demo. It is where the attract loop closes: bootInit falls in here at cold start, and the round
 *   teardown finishAttractCycle loops back here, so the attract demo plays over and over between games.
 *
 * ROLE IN THE MACHINE
 *   Part of the four-routine attract join: bootInit -> enterAttractCycle -> runAttractCycle ->
 *   finishAttractCycle -> (back to) enterAttractCycle. It writes the round/mode byte at 0x20cf, then
 *   delegates to runAttractCycle, which silences sound, types the attract screens, seeds the field, and
 *   free-runs the demo until play begins. Being a generator, the `yield*` forwards runAttractCycle's
 *   per-frame yields to the engine so the demo advances one displayed frame at a time.
 *
 * ROM 0x18df-...  Grounding: [seen].  (loc_20cf keeps a placeholder name; the same cell is reused
 *   during play as the alien-shot-rate value written by selectAlienShotRate and read by the shot stepper.)
 *
 * LIVE-OUT: memory only.
 */
export function* enterAttractCycle(m) {
  // Seed the attract round/mode state cell (0x20cf) to 0x08 before the demo setup runs.
  m.mem8[loc_20cf] = 0x08;
  // Run the attract setup + demo loop, forwarding its per-frame yields so each demo frame reaches the engine.
  yield* runAttractCycle(m);
}
