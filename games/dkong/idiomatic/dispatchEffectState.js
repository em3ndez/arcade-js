// SPDX-License-Identifier: GPL-3.0-only
/**
 * dispatchEffectState — the router for the effect-sprite state machine held in EFFECT_STATE (0x6340).  ROM 0x1dbd.
 *
 * Once per frame this reads EFFECT_STATE (0x6340) and hands the frame to the handler
 * for that state, writing nothing of its own — it is pure control flow, a four-way branch
 * on a small enum:
 *
 *   - state 0 -> effectStateIdle: idle. The state machine is dormant; nothing happens this frame.
 *   - state 1 -> armScorePopupAndSelectAward: the one-shot that arms the countdown and spawns the effect
 *     sprite, then advances the state to 2.
 *   - state 2 -> loc_1e4a — the frozen oracle for ROM 0x1E4A, whose promoted name in ram.js is
 *     tickDispatcherCountdown; this site keeps the oracle for the stack reason in the import
 *     note below. The countdown. Each frame it works the timer down and, on
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
 * NAME: PROMOTED in understanding pass 12, and the name is taken STRAIGHT FROM THE CELL rather than
 * from any reading of this routine: ram.js names 0x6340 EFFECT_STATE and documents it as "Effect
 * state / 4-way rst-0x28 router (sub_1dbd)" — the cell names this routine as its router, which is
 * corroboration from outside the file (R5). The name therefore asserts exactly what EFFECT_STATE
 * already asserts, and nothing further. Its structural twin dispatchBonusExpiredStep (0x1A07) is
 * named the same way, after its own selector cell.
 * WHAT THIS NAME DOES NOT CLAIM: what the effect-sprite state machine DEPICTS. EFFECT_STATE is
 * [code], not [seen], and the effect semantic is still ungrounded — so "dispatchEffectState" names
 * the router and its selector, not the phenomenon. Its state-2 handler is NOT unnamed — ram.js
 * names ROM 0x1E4A `tickDispatcherCountdown` and the idiomatic file exists — but this CALL SITE
 * deliberately keeps the frozen oracle `loc_1e4a`, because the swap is not stack-neutral and no
 * gate here can vouch for it. The import note below states the reason in full.
 * The rest of the cohort WAS promoted in this pass, on evidence from outside these files rather
 * than from the router: armScorePopupAndSelectAward (ROM 0x1DC9) and the three award setters
 * stageAward300Popup / stageAward500Popup / stageAward800Popup (ROM 0x1E00 / 0x1E08 / 0x1E10),
 * whose sprite codes 0x7D / 0x7E / 0x7F decode out of the sprite graphics ROM as the digit
 * strings "300" / "500" / "800" and whose task arguments index the BCD score table at ROM 0x3529
 * to the same amounts. So WHICH award each setter stages is settled; what the effect DEPICTS
 * still is not, which is why this router's name stops at the selector.
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
 *           armScorePopupAndSelectAward leaves them at entry while the oracle's return chain moves them within
 *           STACK_SCRATCH; dead either way, so they are outside the compare.
 * NAMES:    EFFECT_STATE (0x6340), the router's state byte, from ram.js — a [code]-
 *           confidence name (the state-machine STRUCTURE is certain, the "effect-sprite"
 *           semantic still to ground vs MAME). EFFECT_TIMER (0x6341) is named in ram.js
 *           too and referenced above. 0x0000 is the ROM reset vector, kept hex.
 */
import { EFFECT_STATE } from "./ram.js";
import { NotImplemented } from "../../../boards/dkong/io.js";
import { effectStateIdle } from "./effectStateIdle.js"; // ROM 0x1E49 — state 0 (idle)
import { armScorePopupAndSelectAward } from "./armScorePopupAndSelectAward.js"; // ROM 0x1DC9 — state 1 (arm + advance)
// ROM 0x1E4A — state 2 (countdown). The FROZEN ORACLE deliberately: an idiomatic twin
// (tickDispatcherCountdown.js) exists and 0x1E4A is in ram.js's ROUTINES, so "no idiomatic yet"
// is FALSE. It stays because the oracle is a pure leaf that returns through a Z80 `ret` (two
// `ret`s, zero m.call of its own), so it consumes one guest-stack word that the twin's JS return
// does not — the swap is NOT stack-neutral. Left rather than dissolved because NO gate here can
// vouch for it either way: this routine's equivalence test and the full-flip gate were both
// probed by injecting exactly that 2-byte delta at this call site and NEITHER caught it (the
// site sits in the NMI subtree, whose stack delta perFrame's epilogue overwrites before the
// frame boundary the flip gate samples). An unprovable swap is not worth making.
import { loc_1e4a } from "../translated/loc_1e4a.js";

// The effect-sprite state machine's handlers, indexed by EFFECT_STATE (0x6340). Slot 3
// (the reset vector, ROM 0x0000) is intentionally absent — no handler ever produces it, so
// it and any out-of-range value fall through to the reset-vector error below.
const HANDLERS = [
  effectStateIdle, // state 0 — idle
  armScorePopupAndSelectAward, // state 1 — arm the countdown, spawn the effect sprite, advance to 2
  loc_1e4a, // state 2 — count the timer down, tear the effect down on expiry
];

export function dispatchEffectState(m) {
  const state = m.mem.read8(EFFECT_STATE);
  const handler = HANDLERS[state];
  if (handler) return handler(m);

  // State 3 targets the reset vector and no state beyond 2 is ever produced; surface it
  // loudly, matching the oracle, rather than restarting the machine silently.
  throw new NotImplemented(
    `dispatchEffectState: EFFECT_STATE (0x6340) state ${state} has no handler (state 3 is the ROM 0x0000 reset ` +
      `vector; states above 2 do not occur in play).`,
  );
}
