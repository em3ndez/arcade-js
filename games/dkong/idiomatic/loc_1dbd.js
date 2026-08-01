// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1dbd — the router for the effect-sprite state machine held in EFFECT_STATE (0x6340).  ROM 0x1dbd.
 *
 * Once per frame this reads EFFECT_STATE (0x6340) and hands the frame to the handler
 * for that state, writing nothing of its own — it is pure control flow, a four-way branch
 * on a small enum:
 *
 *   - state 0 -> loc_1e49: idle. The state machine is dormant; nothing happens this frame.
 *   - state 1 -> loc_1dc9: the one-shot that arms the countdown and spawns the effect
 *     sprite, then advances the state to 2.
 *   - state 2 -> loc_1e4a: the countdown. Each frame it works the timer down and, on
 *     expiry, tears the effect down and returns the machine to state 0.
 *   - state 3 -> the reset vector. This entry points at the machine's cold-start address
 *     and is a defensive slot only: no handler ever writes state 3, so normal play never
 *     produces it. Reaching it would restart the machine, so — like every untranslated
 *     target — it is surfaced as a loud error rather than a silent reset.
 *
 * Because the state byte only ever holds 0, 1 or 2 in play, the reachable behaviour is
 * fully covered by the three-entry handler table; any other value falls through to the
 * reset-vector error. Every handler is reached by a tail transfer, so here each is a
 * direct call and the routine simply returns whatever the chosen handler returns (nothing
 * is consumed by the caller either way).
 *
 * NAME: kept the neutral loc_ — the mechanics are certain (a four-way router on
 * EFFECT_STATE 0x6340), but WHAT this effect-sprite state machine is remains
 * unestablished (ram.js names the cluster at [code] confidence, semantic still to
 * ground); its whole cohort
 * (loc_1dc9, loc_1e49, loc_1e4a and the setter family below them) deliberately stayed
 * neutral for that reason, and naming the router past them would overclaim. Promote the
 * family together once the effect it drives is corroborated.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1dbd.test.js.
 * GATE:     crafted-entry — oracle-vs-idiomatic on real captured 0x1dbd dispatches
 *           (attract naturally reaches all three reachable states: 0 idle, 1 arm, 2
 *           countdown), compared on RAM − STACK_SCRATCH with a FRESH clone per case
 *           (state 1 and state 2 write memory and advance the task ring). Plus a crafted
 *           state sweep {0,1,2} on real bases exercising every reachable arm, and a
 *           crafted state-3 entry proving both sides throw on the reset-vector slot. Two
 *           teeth: a state-2 handler dropped to a no-op (misses the countdown) and a
 *           state-1 handler dropped to a no-op (misses the effect one-shot), each caught.
 * LIVE-OUT: memory-only — this routine writes nothing itself; the visible RAM is entirely
 *           the chosen handler's (EFFECT_STATE 0x6340 / EFFECT_TIMER 0x6341, the effect
 *           sound, the task ring, the sprite record). No register or flag is a live-out:
 *           the caller (loc_197a) reads
 *           none on return, and none of the three handlers needs a register set on entry.
 *           SP/pc are the dropped stack model — on the state-1 arm the fully-idiomatic
 *           loc_1dc9 leaves them at entry while the oracle's return chain moves them within
 *           STACK_SCRATCH; dead either way, so they are outside the compare.
 * NAMES:    EFFECT_STATE (0x6340), the router's state byte, from ram.js — a [code]-
 *           confidence name (the state-machine STRUCTURE is certain, the "effect-sprite"
 *           semantic still to ground vs MAME). EFFECT_TIMER (0x6341) is named in ram.js
 *           too and referenced above. 0x0000 is the ROM reset vector, kept hex.
 */
import { EFFECT_STATE } from "./ram.js";
import { NotImplemented } from "../../../boards/dkong/io.js";
import { loc_1e49 } from "./loc_1e49.js"; // ROM 0x1E49 — state 0 (idle)
import { loc_1dc9 } from "./loc_1dc9.js"; // ROM 0x1DC9 — state 1 (arm + advance)
import { loc_1e4a } from "../translated/loc_1e4a.js"; // ROM 0x1E4A — state 2 (countdown); no idiomatic yet, call the oracle

// The effect-sprite state machine's handlers, indexed by EFFECT_STATE (0x6340). Slot 3
// (the reset vector, ROM 0x0000) is intentionally absent — no handler ever produces it, so
// it and any out-of-range value fall through to the reset-vector error below.
const HANDLERS = [
  loc_1e49, // state 0 — idle
  loc_1dc9, // state 1 — arm the countdown, spawn the effect sprite, advance to 2
  loc_1e4a, // state 2 — count the timer down, tear the effect down on expiry
];

export function loc_1dbd(m) {
  const state = m.mem.read8(EFFECT_STATE);
  const handler = HANDLERS[state];
  if (handler) return handler(m);

  // State 3 targets the reset vector and no state beyond 2 is ever produced; surface it
  // loudly, matching the oracle, rather than restarting the machine silently.
  throw new NotImplemented(
    `loc_1dbd: EFFECT_STATE (0x6340) state ${state} has no handler (state 3 is the ROM 0x0000 reset ` +
      `vector; states above 2 do not occur in play).`,
  );
}
