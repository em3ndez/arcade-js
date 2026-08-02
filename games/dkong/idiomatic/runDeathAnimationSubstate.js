// SPDX-License-Identifier: GPL-3.0-only
/**
 * runDeathAnimationSubstate — the sub-state that plays Mario's DEATH ANIMATION: service the
 * effect-sprite state machine, then run the death-animation phase dispatch.  ROM 0x127C.
 *
 * It sits in BOTH sub-state tables, and the header used to name only the first:
 *   - entry 4 of the game-state-1 (attract) table at ROM 0x0748 (runAttractState /
 *     handler_073c) — the attract demo ends by killing its own Mario, and this is that death;
 *   - entry 0x0D of the credited-game (GAME_STATE 3) table at ROM 0x0702, i.e. in-game
 *     sub-state 0x0D — the gameplay arm 0x0C (0x197A) hands over to it the frame Mario dies,
 *     and it hands on to the life-loss handlers at 0x0E (0x12F2) / 0x0F (0x1344).
 * Measured: 3 in-game episodes per credited 1P game, 6 per 2P game, 9 per 400 s of attract.
 *
 * It does exactly two things, back to back, and nothing of its own:
 *
 *   1. Service the effect-sprite state machine — dispatchEffectState routes EFFECT_STATE (0x6340) to
 *      its per-state handler (idle / arm / countdown).
 *   2. Fall straight through into the death-animation dispatch — dispatchDeathAnimationPhase
 *      vectors DEATH_ANIM_PHASE (0x639D) through its ROM jump table to the current phase's
 *      handler (seed / step / hand-off).
 *
 * The oracle reaches the second step by falling through the `call 0x1dbd` return into
 * entry_127f (the two routines are physically adjacent in ROM). Here that fall-through is a
 * plain second call. dispatchDeathAnimationPhase is a tail dispatch — its handler's own return returns past
 * this routine — so its result is propagated unchanged, exactly as the oracle's
 * `return m.call(0x127f)` does (inert today: dispatchDeathAnimationPhase's callers ignore the returned value).
 *
 * Neither callee takes a register input — each reads its selector straight from RAM
 * (EFFECT_STATE / DEATH_ANIM_PHASE) — so there is no register-ABI marshalling; both are
 * direct calls.
 *
 * NAME — GROUNDED, and corroborated from OUTSIDE this routine (R5). Live MAME 0.288 on the
 * real dkong ROM, 136,367 logged frames over five runs (attract, 1P, 2P, poked-board),
 * positive control ≈1 NMI fetch per frame, 44 episodes of this sub-state observed
 * (43 complete, all identical; the 44th cut off by end-of-run) — see
 * scratchpad/pass13-grounding.md §2. The outside evidence:
 *   - ram.js names the two cells this sub-state's dispatch walks — DEATH_ANIM_PHASE (0x639D)
 *     and DEATH_ANIM_TICKS_LEFT (0x639E) — both at [seen], on this same run;
 *   - the ROM table position: 0x0702 puts it at 0x0D, between gameplay (0x0C) and the two
 *     life-loss handlers (0x0E / 0x0F), and 15 deaths produced 15 LIVES (0x6228) decrements
 *     in those handlers (12 at pc 0x12FD, 3 at pc 0x134F), none from anywhere else;
 *   - the hardware: the sound line the phase-0 arm fires (SND_IRQ_TRIGGER 0x6088, ROM 0x12A8)
 *     is MAME's "dead" line (dkong.cpp:202); games/dkong/audio/README.md traces exactly 3
 *     rises in 90 s — one per life — each ~64 frames after the hit that killed Mario;
 *   - ★ NEGATIVE CONTROL: across 42,275 frames of ordinary play (Mario alive) both cells are
 *     0 on EVERY frame, and across all 87,142 non-cluster frames 0x639E never transitions.
 * WHAT THE NAME DOES NOT CLAIM. (a) Not a cause: it does NOT claim "runs when something
 * kills Mario". The bonus-timer-expiry death reaches the same sequence with MARIO_ACTIVE
 * (0x6200) still 1 — ROM 0x1A2A jumps into the middle of the same instructions at 0x19D2,
 * stepping over the MARIO_ACTIVE test — so the name is by EFFECT, not by trigger. (b) It does
 * not claim to decrement LIVES: that happens in the NEXT sub-state (0x12F2 / 0x1344), which
 * the dispatch's phase-2 arm hands off to. (c) It makes no pixel claim — pass 13 ran with
 * `-video none`; what was observed is RAM and opcode fetches, i.e. a 296-frame sequence of
 * four cycling (code, attr) sprite pairs settling on tile 0x7A, not a description of what a
 * player sees. (d) It does not claim the effect-sprite service in step 1 belongs to the death
 * animation; that is a separate machine (EFFECT_STATE 0x6340) this sub-state also drives.
 *
 * Memory-equivalent to the frozen oracle — equivalence-127c.test.js.
 * GATE:     captured + crafted. Real captured 0x127C attract dispatches (888 over a long
 *           attract run; EFFECT_STATE {0,2}, DEATH_ANIM_PHASE {0,1,2}) replayed oracle vs
 *           this routine on RAM − STACK_SCRATCH with a fresh clone per case; crafted entries
 *           force EFFECT_STATE {0,1,2} (on a base with a live effect-param pointer) and each
 *           death-animation phase {0,1,2} with the tick gate open, so every reachable arm of
 *           both callees is driven. Teeth: a twin that drops the effect-router call (caught
 *           on a state-2 countdown) and a twin that drops the death-animation dispatch
 *           (caught on a phase-0 seed). COVERAGE HOLE, stated plainly (R17): the captures are
 *           from an ATTRACT run only — the in-game (GAME_SUBSTATE 0x0D) dispatches are not
 *           replayed here, though the code path is identical and MAME shows the same phase
 *           walk in both.
 * LIVE-OUT: memory-only — this routine writes nothing itself; the visible RAM is entirely
 *           the two callees' (the effect cluster 0x6340+, the death-animation cells
 *           0x639D/0x639E, the sprite record, the sub-state). No register/flag is a live-out
 *           — the caller (runAttractState) reads none on return. SP/pc are the dropped stack
 *           model: the oracle's `call`/fall-through push-pop moves them within the dead
 *           STACK_SCRATCH, and neither is consumed, so both are outside the compare.
 * NAMES:    none of its own — runDeathAnimationSubstate indexes no RAM cell directly. The named cells its
 *           callees read (EFFECT_STATE 0x6340, DEATH_ANIM_PHASE 0x639D, DEATH_ANIM_TICKS_LEFT 0x639E)
 *           are imported and used inside those routines and named in ram.js.
 */

import { dispatchEffectState } from "./dispatchEffectState.js"; // ROM 0x1DBD — effect-sprite state-machine router
import { dispatchDeathAnimationPhase } from "./dispatchDeathAnimationPhase.js"; // ROM 0x127F — death-animation phase dispatch

export function runDeathAnimationSubstate(m) {
  // call 0x1dbd — service the effect-sprite state machine for this frame.
  dispatchEffectState(m);

  // Fall through into the death-animation dispatch. It is a tail dispatch, so its handler's
  // own return returns on this routine's behalf; propagate it unchanged.
  return dispatchDeathAnimationPhase(m);
}
