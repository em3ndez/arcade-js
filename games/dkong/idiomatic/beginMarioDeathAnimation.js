// SPDX-License-Identifier: GPL-3.0-only
/**
 * beginMarioDeathAnimation — phase-0 (seed) arm of Mario's DEATH ANIMATION: point his sprite at
 * the first death tile, prime the 13-tick counter, clear sprite runs, fire the death sound
 * line, then advance the phase.  ROM 0x128B.
 *
 * The seed arm (arm 0) of the phase state machine dispatched by dispatchDeathAnimationPhase (the
 * rst-0x28 table at ROM 0x1283, selector DEATH_ANIM_PHASE 0x639D): arm 0 (this routine) seeds the
 * animation, arm 1 (stepMarioDeathAnimation) runs the 13 gate ticks, arm 2 (loc_12de) hands off
 * to the life-loss sub-state. Like its siblings it is gated by the sub-state timer, so
 * it acts only on the frame that gate expires:
 *
 *   - The `rst 0x18` gate (tickSubstateTimer) ticks SUBSTATE_TIMER (0x6009). While it is
 *     still counting down the arm is skipped this frame — the Z80 caller-skip, modelled as
 *     a plain early return on the callee's `false`.
 *   - On expiry it rewrites Mario's sprite-code byte (0x694D) to the fixed tile code 0x78,
 *     preserving its old bit 7 (Mario's facing flag → 0xF8 if set) — the first of the four
 *     orientations arm 1 then cycles.
 *   - Advances DEATH_ANIM_PHASE (0x639D) 0 → 1 and primes DEATH_ANIM_TICKS_LEFT
 *     (0x639E) = 0x0D (13), then re-arms the gate to 8 — the 8-FRAME tick cadence arm 1 runs on.
 *   - Clears four disjoint sprite-record runs via loc_30bd, then fires the death sound
 *     (SND_IRQ_TRIGGER 0x6088 = 3, a 3-frame assert of the I8035 IRQ line at 0x7D80).
 *
 * NAME — GROUNDED, and corroborated from OUTSIDE this routine (R5). Live MAME 0.288 on the
 * real dkong ROM (scratchpad/pass13-grounding.md §2), 136,367 logged frames, positive control
 * ≈1 NMI fetch per frame, 44 episodes: this arm's two write sites are seen exactly once per
 * episode — pc 0x1299 writing 0x639D = 1 and pc 0x129E writing 0x639E = 0x0D — with the
 * post-gate body fetched 11 times in the run where 11 episodes ran (704 entry fetches =
 * 64 × 11), i.e. one seed per death, zero strays. The outside evidence:
 *   - ram.js holds both cells at [seen] with this same run behind them;
 *   - the caller chain: this arm's dispatcher is sub-state 0x0D of the 0x0702 table, sitting
 *     between gameplay (0x0C) and the life-loss handlers (0x0E / 0x0F); 15 observed deaths
 *     produced 15 LIVES (0x6228) decrements in those handlers and none anywhere else;
 *   - ★ the HARDWARE, independent of any of our reasoning: the line this routine's last
 *     instruction (ROM 0x12A8) asserts is MAME's "dead" line — dkong.cpp:202 labels it, and
 *     games/dkong/audio/README.md traces exactly 3 rises in 90 s of play, one per life, each
 *     ~64 frames after the hit that killed Mario, with ROM 0x12A8 the SOLE writer;
 *   - ★ NEGATIVE CONTROL: 42,275 frames of ordinary play with 0x639D and 0x639E both 0 on
 *     every frame.
 * WHAT THE NAME DOES NOT CLAIM. "begin" names the START of the animation, not the cause of the
 * death — this routine does not detect, decide or perform a kill, and the animation is NOT
 * conditional on MARIO_ACTIVE (0x6200) being 0: the bonus-timer-expiry death reaches the same
 * sequence with MARIO_ACTIVE still 1 (ROM 0x1A2A jumps into the middle of the same
 * instructions at 0x19D2, stepping over the MARIO_ACTIVE test). It does not claim to take the
 * life (that is the following sub-state, 0x12F2 / 0x1344), and it makes no pixel claim: pass 13
 * ran `-video none`, so tile 0x78 is a byte written to the sprite record, not an observation
 * of what is drawn. The sprite runs loc_30bd clears are pinned by address, not by identity.
 *
 * Callees: tickSubstateTimer (rst 0x18, 0x0018), the idiomatic version, called directly;
 * and loc_30bd (0x30BD) — STILL THE FROZEN ORACLE, called directly. Note the header used to
 * justify that with "no idiomatic yet", which is FALSE: idiomatic/clearSpriteColumns.js exists
 * and 0x30BD is in ram.js's ROUTINES map. This file deliberately still calls the oracle;
 * swapping the import is a behaviour-affecting change (the tail-jump return accounting below),
 * so DISSOLVING this stale oracle reference is PENDING as its own unit — it is not done here.
 * The Z80 `ret` is the caller-skip's net return, which the equivalence harness reconciles (this
 * routine models no stack). loc_30bd ends in a TAIL JUMP into sub_30e4, so when called
 * directly its final `ret` consumes this routine's own return slot — the harness accounts
 * for that per-arm (see equivalence-128b.test.js).
 *
 * Memory-equivalent to the frozen oracle — equivalence-128b.test.js.
 * GATE:     crafted-entry — 64 real attract dispatches over 3000 frames (63 skip-arm, 1
 *           seed-arm on the expiry frame, all identical) + crafted seed/skip arms poked from
 *           a real capture so both arms are covered regardless of timing. Teeth: a wrong
 *           sprite-code store and a gate-polarity inversion, both caught. Compared vs the
 *           oracle over RAM (−STACK_SCRATCH) + pc + SP.
 * LIVE-OUT: memory-only — the sprite-code byte 0x694D, the phase 0x639D, the tick counter
 *           0x639E, SUBSTATE_TIMER (0x6009), loc_30bd's cleared runs, and SND_IRQ_TRIGGER
 *           (0x6088). Dispatched from the rst-0x28 table inside the vblank NMI, whose tail
 *           reads none of its registers; the oracle's residual A/HL and flags are dead ABI
 *           (pc/SP model the caller-skip return + loc_30bd's tail-jump pop, both reconciled
 *           by the harness).
 * NAMES:    SUBSTATE_TIMER (0x6009), MARIO_SPRITE_RECORD (0x694C), SND_IRQ_TRIGGER (0x6088),
 *           DEATH_ANIM_PHASE (0x639D) and DEATH_ANIM_TICKS_LEFT (0x639E) from ram.js — the last
 *           two now [seen], grounded on the pass-13 MAME runs cited above.
 */

import {
  SUBSTATE_TIMER,
  MARIO_SPRITE_RECORD,
  SND_IRQ_TRIGGER,
  DEATH_ANIM_PHASE,
  DEATH_ANIM_TICKS_LEFT,
} from "./ram.js";
import { tickSubstateTimer } from "./tickSubstateTimer.js"; // ROM 0x0018 (rst 0x18)
// ROM 0x30BD — the FROZEN ORACLE, and it STAYS. An idiomatic twin (clearSpriteColumns.js) exists
// and 0x30BD is in ram.js's ROUTINES map, so "no idiomatic yet" would be false. The swap is not
// stack-neutral: loc_30bd's fourth clear is a `jp 0x30E4` TAIL JUMP, so sub_30e4's `ret` returns
// on loc_30bd's behalf and consumes a word; clearSpriteColumns makes four plain JS calls and
// consumes none. CONFIRMED BY MEASUREMENT (not by reading): swapping the import fails this
// routine's own equivalence gate — pc oracle=0x12A6 vs candidate 0x30BD, SP 0x6BF0 vs 0x6BEE.
// Dissolving it means moving that tail return into this routine, an ABI change rather than an
// import swap, so it is out of scope for a call-target dissolve.
import { loc_30bd } from "../translated/loc_30bd.js";

// The sprite-code byte (+1) of Mario's hardware sprite record at 0x694C.
const SPRITE_CODE = MARIO_SPRITE_RECORD + 1; // 0x694D

export function beginMarioDeathAnimation(m) {
  const { mem } = m;

  // rst 0x18 gate: until SUBSTATE_TIMER expires this frame, skip the arm entirely
  // (the Z80 caller-skip, now a plain early return on `false`).
  if (!tickSubstateTimer(m)) return;

  // Point Mario's sprite at the first death tile: rewrite the sprite-code byte to the fixed
  // tile code 0x78, keeping its old bit 7 (Mario's facing flag → 0xF8 if set). Mirrors the
  // oracle's `rl (hl)` (old bit 7 → carry) + `ld a,0xF0` + `rra` (0xF0 >> 1 = 0x78, carry →
  // bit 7); the rl's own store is dead, overwritten by this one. Preserving that facing bit
  // is why the cycle arm 1 runs comes in two flavours (31 / 13 of the 44 episodes observed).
  const code = mem.read8(SPRITE_CODE);
  mem.write8(SPRITE_CODE, (code & 0x80) | 0x78);

  // Advance DEATH_ANIM_PHASE 0 → 1, prime the tick counter to 13, and re-arm the gate to the
  // 8-frame cadence arm 1 (stepMarioDeathAnimation) runs on.
  mem.write8(DEATH_ANIM_PHASE, (mem.read8(DEATH_ANIM_PHASE) + 1) & 0xff);
  mem.write8(DEATH_ANIM_TICKS_LEFT, 0x0d);
  mem.write8(SUBSTATE_TIMER, 0x08);

  // Clear four disjoint sprite-record runs (0x6950/0x6980/0x69B8/0x6A0C, stride 4).
  // Still the frozen oracle — see the import note; the dissolve is a pending unit.
  loc_30bd(m); // ROM 0x30BD

  // Fire the death sound: SND_IRQ_TRIGGER = 3 is a 3-frame assert of the I8035 interrupt
  // line (0x7D80), MAME's "dead" line (dkong.cpp:202). This store, ROM 0x12A8, is its
  // SOLE writer in the whole ROM.
  mem.write8(SND_IRQ_TRIGGER, 0x03);
}
