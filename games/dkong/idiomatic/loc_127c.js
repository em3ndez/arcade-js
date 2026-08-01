// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_127c — attract sub-state 4: service the effect-sprite state machine, then run the
 * blink-animation dispatch.  ROM 0x127C.
 *
 * Entry 4 of the game-state-1 (attract) sub-state jump table at ROM 0x0748
 * (runAttractState / handler_073c). It does exactly two things, back to back, and nothing
 * of its own:
 *
 *   1. Service the effect-sprite state machine — loc_1dbd routes EFFECT_STATE (0x6340) to
 *      its per-state handler (idle / arm / countdown).
 *   2. Fall straight through into the blink-animation dispatch — loc_127f vectors
 *      BLINK_ANIM_PHASE (0x639D) through its ROM jump table to the current step's handler.
 *
 * The oracle reaches the second step by falling through the `call 0x1dbd` return into
 * entry_127f (the two routines are physically adjacent in ROM). Here that fall-through is a
 * plain second call. loc_127f is a tail dispatch — its handler's own return returns past
 * this routine — so its result is propagated unchanged, exactly as the oracle's
 * `return m.call(0x127f)` does (inert today: loc_127f's callers ignore the returned value).
 *
 * Neither callee takes a register input — each reads its selector straight from RAM
 * (EFFECT_STATE / BLINK_ANIM_PHASE) — so there is no register-ABI marshalling; both are
 * direct calls.
 *
 * NAME: kept neutral loc_127c. Both callees are themselves neutral loc_ (the effect machine
 * and the blink sequence are pinned mechanically but not grounded semantically), so putting
 * an English name on their sequencer would overclaim. Promote once the effect/blink identity
 * is corroborated.
 *
 * Memory-equivalent to the frozen oracle — equivalence-127c.test.js.
 * GATE:     captured + crafted. Real captured 0x127C attract dispatches (888 over a long
 *           attract run; EFFECT_STATE {0,2}, BLINK_ANIM_PHASE {0,1,2}) replayed oracle vs
 *           this routine on RAM − STACK_SCRATCH with a fresh clone per case; crafted entries
 *           force EFFECT_STATE {0,1,2} (on a base with a live effect-param pointer) and each
 *           blink phase {0,1,2} with the tick gate open, so every reachable arm of both
 *           callees is driven. Teeth: a twin that drops the effect-router call (caught on a
 *           state-2 countdown) and a twin that drops the blink dispatch (caught on a
 *           phase-0 seed).
 * LIVE-OUT: memory-only — this routine writes nothing itself; the visible RAM is entirely
 *           the two callees' (the effect cluster 0x6340+, the blink sequence 0x639D/0x639E,
 *           the sprite record, the sub-state). No register/flag is a live-out — the caller
 *           (runAttractState) reads none on return. SP/pc are the dropped stack model: the
 *           oracle's `call`/fall-through push-pop moves them within the dead STACK_SCRATCH,
 *           and neither is consumed, so both are outside the compare.
 * NAMES:    none of its own — loc_127c indexes no RAM cell directly. The named cells its
 *           callees read (EFFECT_STATE 0x6340, BLINK_ANIM_PHASE 0x639D, BLINK_COUNT 0x639E)
 *           are imported and used inside those routines and named in ram.js.
 */

import { loc_1dbd } from "./loc_1dbd.js"; // ROM 0x1DBD — effect-sprite state-machine router
import { loc_127f } from "./loc_127f.js"; // ROM 0x127F — blink-animation phase dispatch

export function loc_127c(m) {
  // call 0x1dbd — service the effect-sprite state machine for this frame.
  loc_1dbd(m);

  // Fall through into the blink-animation dispatch. It is a tail dispatch, so its handler's
  // own return returns on this routine's behalf; propagate it unchanged.
  return loc_127f(m);
}
