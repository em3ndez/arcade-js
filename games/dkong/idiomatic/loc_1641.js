// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1641 — run the effect-sprite state machine, then dispatch the board-render
 * sequence step.  ROM 0x1641.
 *
 * The fall-through arm of loc_1615's board-advance dispatcher (GAME_SUBSTATE 0x600A ==
 * 0x16), taken when BOARD is neither of the two bit-gated cases. It does two independent
 * things in order, one after the other:
 *
 *   1. Run the effect-sprite state machine one frame (dispatchEffectState) — a four-way router on
 *      EFFECT_STATE (0x6340) that either idles, arms/spawns the effect, or counts it down.
 *   2. Dispatch the board-render / how-high sequence to its current-step handler
 *      (loc_1644) — read the sequence step counter at 0x6388 and vector through the
 *      6-entry ROM jump table at 0x1648 to the handler that paints/animates this step.
 *
 * The two callees each read their own inputs straight from memory, so nothing is threaded
 * between them here — loc_1641 just chains the two calls. Nothing consumes a return value
 * at this level (loc_1615 tail-returns into the sub-state dispatcher, which discards it),
 * so this is void.
 *
 * NAME: kept the neutral loc_ on purpose. This is a plain sequence of two routines that
 * are BOTH themselves kept neutral — the effect-sprite machine's semantics (dispatchEffectState's
 * cohort) and the board-render sequence (loc_1644's family) are not confirmed to the
 * routine-name bar — so an English name here would over-assert past its own parts. Promote
 * once both families are grounded.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1641.test.js.
 * GATE:     crafted-entry — not reached in plain attract (a board is never completed
 *           there), so a real attract base (captured at a live 0x1dbd dispatch, for a
 *           valid effect param pointer) is poked over the cross-product of effect state
 *           {0,1,2} × render step {0..5} with the FULL oracle handlers run on BOTH sides.
 *           Teeth: a twin that drops the effect-machine call (caught on states 1/2) and a
 *           twin that drops the render dispatch (caught on every step).
 * LIVE-OUT: memory-only — no caller reads a register or the return on the way out. The
 *           effect machine's idiomatic state-1 arm leaves SP/pc where the oracle's return
 *           chain does not, so SP/pc are the dropped stack model, outside the compare.
 * NAMES:    none directly — loc_1641 references no work-RAM cell itself; EFFECT_STATE
 *           (0x6340) and the render step selector (0x6388) live inside the two callees.
 */

import { dispatchEffectState } from "./dispatchEffectState.js"; // ROM 0x1DBD — effect-sprite state machine router
import { loc_1644 } from "./loc_1644.js"; // ROM 0x1644 — board-render sequence step dispatch

export function loc_1641(m) {
  // Run the effect-sprite state machine one frame.
  dispatchEffectState(m);

  // Dispatch the board-render sequence to its current-step handler.
  loc_1644(m);
}
