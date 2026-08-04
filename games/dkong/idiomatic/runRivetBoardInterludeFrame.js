// SPDX-License-Identifier: GPL-3.0-only
/**
 * runRivetBoardInterludeFrame — run the effect-sprite state machine, then dispatch the board-render
 * sequence step.  ROM 0x1641.
 *
 * The fall-through arm of dispatchBoardClearedInterlude's board-advance dispatcher (GAME_SUBSTATE 0x600A ==
 * 0x16), taken when BOARD is neither of the two bit-gated cases. It does two independent
 * things in order, one after the other:
 *
 *   1. Run the effect-sprite state machine one frame (dispatchEffectState) — a four-way router on
 *      EFFECT_STATE (0x6340) that either idles, arms/spawns the effect, or counts it down.
 *   2. Dispatch the 100m interlude sequence to its current-step handler
 *      (dispatchRivetBoardInterludeStep) — read BOARD_ADVANCE_STEP (0x6388) and vector through the
 *      6-entry ROM jump table at 0x1648 to the handler that paints/animates this step.
 *
 * The two callees each read their own inputs straight from memory, so nothing is threaded
 * between them here — runRivetBoardInterludeFrame just chains the two calls. Nothing consumes a return value
 * at this level (dispatchBoardClearedInterlude tail-returns into the sub-state dispatcher, which discards it),
 * so this is void.
 *
 * NAME: promoted in understanding pass 15 by a proposer plus an independent blind confirmer
 * (docs/reviewer-rules.md R4/R5). This routine's own body is two calls, so ALL of the naming
 * evidence is necessarily outside it. Which board: dispatchBoardClearedInterlude reaches this arm
 * only when BOARD has neither bit0 nor bit1 set, which among the four boards in play leaves only
 * BOARD 4 — "4=100m rivets" in names.js's `[seen]` BOARD note — and the pass-14 grounding saw the
 * 0x1648 table's six targets used on board 4 and nowhere else, plus the only six frames on which
 * the playfield tilemap changes inside sub-state 0x16, all on board 4. Which frame: its first
 * callee dispatchEffectState is an already-promoted English name whose selector EFFECT_STATE
 * (0x6340) is a named cell, and its second is the 100m step dispatcher. The blind confirmer named
 * it `runEffectSpritesAndDispatch100mStep` and voted PROMOTE — it named the PAIRING where the
 * promoted name names the SCENE, so the wording genuinely differs; what both derivations state is
 * the same, that this is the 100m/rivet-board arm and that it ticks the effect-sprite machine and
 * then dispatches that board's interlude step, in that order.
 *
 * The name claims nothing about what the 100m interlude LOOKS like — the collapse/fall/reunion
 * reading of its steps comes from grounding snapshots and belongs to the step handlers, not here.
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
 * NAMES:    none directly — runRivetBoardInterludeFrame references no work-RAM cell itself;
 *           EFFECT_STATE (0x6340) and BOARD_ADVANCE_STEP (0x6388) live inside the two callees.
 */

import { dispatchEffectState } from "./dispatchEffectState.js"; // ROM 0x1DBD — effect-sprite state machine router
import { dispatchRivetBoardInterludeStep } from "./dispatchRivetBoardInterludeStep.js"; // ROM 0x1644 — 100m interlude step dispatch

export function runRivetBoardInterludeFrame(m) {
  // Run the effect-sprite state machine one frame.
  dispatchEffectState(m);

  // Dispatch the 100m interlude sequence to its current-step handler.
  dispatchRivetBoardInterludeStep(m);
}
