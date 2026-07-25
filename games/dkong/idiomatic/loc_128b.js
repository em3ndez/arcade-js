// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_128b — phase-0 (seed) arm of the 0x639D animation sequence: turn the two-cell
 * blinker on, prime the blink repeat-count, clear its sprite runs, fire a sound, then
 * advance the phase.  ROM 0x128B.
 *
 * The seed arm (arm 0) of the sequence-phase state machine dispatched by loc_127f (the
 * rst-0x28 table at ROM 0x1283, selector 0x639D): arm 0 (this routine) seeds the blinker
 * and its repeat count, arm 1 (loc_12ac) runs the blink loop, arm 2 (loc_12de) hands off
 * to the following game sub-state. Like its siblings it is gated by the sub-state timer, so
 * it acts only on the frame that gate expires:
 *
 *   - The `rst 0x18` gate (tickSubstateTimer) ticks SUBSTATE_TIMER (0x6009). While it is
 *     still counting down the arm is skipped this frame — the Z80 caller-skip, modelled as
 *     a plain early return on the callee's `false`.
 *   - On expiry it turns the blinker ON: rewrites Mario's sprite-code byte (0x694D) to the
 *     fixed tile code 0x78, preserving its old bit 7 (Mario's facing flag → 0xF8 if set).
 *   - Advances the phase 0x639D 0 → 1 and primes the blink repeat-count 0x639E = 0x0D, then
 *     re-arms the gate to 8 (the 8-frame blink cadence arm 1 runs on).
 *   - Clears the blinker's four disjoint sprite-record runs via sub_30bd, then fires the
 *     sequence's sound cue (SND_IRQ_TRIGGER 0x6088 = 3).
 *
 * NAME: kept neutral loc_128b on purpose, to match its dispatcher loc_127f and its sibling
 * arm loc_12ac. The seed/blink/advance MECHANISM is fully understood and corroborated (the
 * oracle header and loc_127f's arm-0 description agree), but the selector 0x639D is
 * deliberately unnamed in ram.js and the animated sequence's game-semantic identity is not
 * settled to the proposer!=confirmer bar, so an English name would over-assert. Promote
 * alongside loc_127f/loc_12ac only once 0x639D is confirmed.
 *
 * Callees: tickSubstateTimer (rst 0x18, 0x0018), the idiomatic version, called directly;
 * and sub_30bd (0x30BD), still the frozen oracle (no idiomatic yet), called directly. The
 * Z80 `ret` is the caller-skip's net return, which the equivalence harness reconciles (this
 * routine models no stack). sub_30bd ends in a TAIL JUMP into sub_30e4, so when called
 * directly its final `ret` consumes this routine's own return slot — the harness accounts
 * for that per-arm (see equivalence-128b.test.js).
 *
 * Memory-equivalent to the frozen oracle — equivalence-128b.test.js.
 * GATE:     crafted-entry — 64 real attract dispatches over 3000 frames (63 skip-arm, 1
 *           seed-arm on the expiry frame, all identical) + crafted seed/skip arms poked from
 *           a real capture so both arms are covered regardless of timing. Teeth: a wrong
 *           sprite-code store and a gate-polarity inversion, both caught. Compared vs the
 *           oracle over RAM (−STACK_SCRATCH) + pc + SP.
 * LIVE-OUT: memory-only — the sprite-code byte 0x694D, the phase 0x639D, the blink count
 *           0x639E, SUBSTATE_TIMER (0x6009), sub_30bd's cleared runs, and SND_IRQ_TRIGGER
 *           (0x6088). Dispatched from the rst-0x28 table inside the vblank NMI, whose tail
 *           reads none of its registers; the oracle's residual A/HL and flags are dead ABI
 *           (pc/SP model the caller-skip return + sub_30bd's tail-jump pop, both reconciled
 *           by the harness).
 * NAMES:    SUBSTATE_TIMER (0x6009), MARIO_SPRITE_RECORD (0x694C), SND_IRQ_TRIGGER (0x6088)
 *           from ram.js; 0x639D (phase) and 0x639E (blink repeat-count) kept hex, unconfirmed
 *           in ram.js.
 */

import { SUBSTATE_TIMER, MARIO_SPRITE_RECORD, SND_IRQ_TRIGGER } from "../optimized/ram.js";
import { tickSubstateTimer } from "./tickSubstateTimer.js"; // ROM 0x0018 (rst 0x18)
import { sub_30bd } from "../translated/sub_30bd.js"; // ROM 0x30BD — no idiomatic yet; call the oracle

// Sequence-phase selector and the blink repeat-count. Unconfirmed in ram.js, kept hex.
const PHASE = 0x639d;
const BLINK_COUNT = 0x639e;

// The blinker cell: sprite-code byte (+1) of Mario's hardware sprite record at 0x694C.
const SPRITE_CODE = MARIO_SPRITE_RECORD + 1; // 0x694D

export function loc_128b(m) {
  const { mem } = m;

  // rst 0x18 gate: until SUBSTATE_TIMER expires this frame, skip the arm entirely
  // (the Z80 caller-skip, now a plain early return on `false`).
  if (!tickSubstateTimer(m)) return;

  // Turn the blinker ON: rewrite the sprite-code byte to the fixed tile code 0x78, keeping
  // its old bit 7 (Mario's facing flag → 0xF8 if set). Mirrors the oracle's `rl (hl)`
  // (old bit 7 → carry) + `ld a,0xF0` + `rra` (0xF0 >> 1 = 0x78, carry → bit 7); the rl's
  // own store is dead, overwritten by this one.
  const code = mem.read8(SPRITE_CODE);
  mem.write8(SPRITE_CODE, (code & 0x80) | 0x78);

  // Advance the phase 0 → 1, prime the blink repeat-count, and re-arm the gate to the
  // 8-frame blink cadence arm 1 (loc_12ac) runs on.
  mem.write8(PHASE, (mem.read8(PHASE) + 1) & 0xff);
  mem.write8(BLINK_COUNT, 0x0d);
  mem.write8(SUBSTATE_TIMER, 0x08);

  // Clear the blinker's four disjoint sprite-record runs (0x6950/0x6980/0x69B8/0x6A0C,
  // stride 4). Still the frozen oracle — no idiomatic version yet.
  sub_30bd(m); // ROM 0x30BD

  // Fire the sequence's sound cue.
  mem.write8(SND_IRQ_TRIGGER, 0x03);
}
