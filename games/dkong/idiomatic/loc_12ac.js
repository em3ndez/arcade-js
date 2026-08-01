// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_12ac — phase-1 arm of the BLINK_ANIM_PHASE (0x639D) animation sequence: on each
 * gate tick toggle the two-cell blinker, and when its repeat-count runs out advance the
 * phase.  ROM 0x12AC.
 *
 * One of the three arms of the sequence-phase state machine dispatched by loc_127f
 * (the rst-0x28 table at ROM 0x1283, selector BLINK_ANIM_PHASE 0x639D): arm 0 (entry_128b) seeds the
 * blinker and the repeat count, this arm (phase == 1) runs the blink loop, arm 2
 * (loc_12de) hands off to the following game sub-state. It is gated by the sub-state
 * timer so it acts only on the frames that gate expires:
 *
 *   - The `rst 0x18` gate (tickSubstateTimer) ticks SUBSTATE_TIMER (0x6009). While it
 *     is still counting down the arm is skipped this frame — the Z80 caller-skip,
 *     modelled as a plain early return on the callee's `false`. On expiry the timer is
 *     reloaded to 8 (a fixed 8-frame blink cadence).
 *   - Decrement the blink repeat-count BLINK_COUNT (0x639E). If it has NOT yet reached zero, toggle
 *     the two-cell blinker at Mario's sprite record (0x694D/0x694E): flip bit 0 of the
 *     sprite-code byte every tick (a two-frame tile swap) and, on the tick that bit 0
 *     falls back to 0, also flip bit 7 of the sprite-code byte and bit 7 of the
 *     attribute byte. Then return.
 *   - When the repeat-count reaches zero (BLINK_COUNT was 1), advance instead: rewrite the
 *     sprite-code byte to a fixed 0x7A (its old bit 7 preserved, so 0xFA if it was set),
 *     bump the phase BLINK_ANIM_PHASE (0x639D) 1 -> 2, and reload the gate long (0x80 = 128
 *     ticks) so arm 2 fires only after a pause.
 *
 * NAME: kept neutral loc_12ac on purpose, to match its dispatcher loc_127f. The
 * blink/advance MECHANISM is fully understood and corroborated (entry_128b seeds the
 * blinker, loc_127f's header describes this arm, the oracle header agrees), and ram.js
 * now names the selector BLINK_ANIM_PHASE (0x639D) and the repeat-count BLINK_COUNT
 * (0x639E) — but at [code] confidence ("WHAT blinks is inferential" per ram.js): the
 * animated sequence's game-semantic identity is still not settled to the
 * proposer!=confirmer bar, so a fully English routine name would over-assert. Promote
 * alongside loc_127f only once the effect is corroborated.
 *
 * Sole callee: tickSubstateTimer (rst 0x18, 0x0018), the idiomatic version, called
 * directly. No other calls; the Z80 `ret` is the caller-skip's single net return, which
 * the equivalence harness supplies (this routine models no stack).
 *
 * Memory-equivalent to the frozen oracle — equivalence-12ac.test.js.
 * GATE:     crafted-entry — 104 real attract dispatches over 3000 frames (91 skip-arm
 *           from frame ~2619, 12 blink-arm from ~2626, 1 advance-arm from ~2722, all
 *           identical) + crafted blink/advance/skip arms poked from a real capture so
 *           every arm is covered regardless of timing. Teeth: a wrong blink store and a
 *           gate-polarity inversion, both caught. Compared vs the oracle over RAM
 *           (−STACK_SCRATCH) + pc + SP.
 * LIVE-OUT: memory-only — SUBSTATE_TIMER (0x6009), the blink count BLINK_COUNT (0x639E),
 *           the phase BLINK_ANIM_PHASE (0x639D), and the sprite record 0x694D/0x694E
 *           (MARIO_SPRITE_RECORD +1/+2). Dispatched from the rst-0x28
 *           table inside the vblank NMI, whose tail reads none of its registers; the
 *           oracle's residual A/B/HL and flags are dead ABI (pc/SP model the single
 *           caller-skip return the harness reconciles).
 * NAMES:    SUBSTATE_TIMER (0x6009), MARIO_SPRITE_RECORD (0x694C), BLINK_ANIM_PHASE
 *           (0x639D), BLINK_COUNT (0x639E) — from ram.js (the last two at [code]
 *           confidence). 0x694D/0x694E are MARIO_SPRITE_RECORD +1/+2.
 */

import { SUBSTATE_TIMER, MARIO_SPRITE_RECORD, BLINK_ANIM_PHASE, BLINK_COUNT } from "./ram.js";
import { tickSubstateTimer } from "./tickSubstateTimer.js";

// The two blinker cells: sprite-code byte (+1) and attribute byte (+2) of Mario's
// hardware sprite record at 0x694C.
const SPRITE_CODE = MARIO_SPRITE_RECORD + 1; // 0x694D
const SPRITE_ATTR = MARIO_SPRITE_RECORD + 2; // 0x694E

export function loc_12ac(m) {
  const { mem } = m;

  // rst 0x18 gate: until SUBSTATE_TIMER expires this frame, skip the arm entirely
  // (the Z80 caller-skip, now a plain early return on `false`).
  if (!tickSubstateTimer(m)) return;

  // Gate expired -> reload it to the 8-frame blink cadence.
  mem.write8(SUBSTATE_TIMER, 0x08);

  // Count down the blink repeats; a zero result means this blink phase is over.
  const remaining = (mem.read8(BLINK_COUNT) - 1) & 0xff;
  mem.write8(BLINK_COUNT, remaining);
  if (remaining === 0) {
    advancePhase(m);
    return;
  }

  // --- blink: toggle the two-cell blinker at 0x694D/0x694E ---
  // The sprite-code byte's bit 0 flips every tick (a two-frame tile swap). `b` carries
  // that flip in bit 0 (always set) and the code's OLD bit 0 in bit 7, so XORing `b`
  // into the code toggles bit 0 always and bit 7 only on the tick bit 0 falls to 0.
  const code = mem.read8(SPRITE_CODE);
  const b = ((code & 0x01) << 7) | 0x01; // 0x81 if old bit 0 set, else 0x01
  mem.write8(SPRITE_CODE, b ^ code);
  // The attribute byte's bit 7 flips on that same "bit 0 fell to 0" tick (b & 0x80).
  mem.write8(SPRITE_ATTR, (b & 0x80) ^ mem.read8(SPRITE_ATTR));
}

/**
 * The phase-advance tail (ROM 0x12CB), reached only when the blink count hits zero.
 * Reachable solely from loc_12ac's advance branch (no external dispatch targets it), so
 * it stays a private helper rather than an export.
 */
function advancePhase(m) {
  const { mem } = m;

  // Rewrite the sprite-code byte to 0x7A, keeping its old bit 7 (-> 0xFA if it was set).
  // Mirrors the oracle's `rl (hl)` (old bit 7 -> carry) + `ld a,0xF4` + `rra`
  // (0xF4 >> 1 = 0x7A, carry -> bit 7); the rl's own store is dead, overwritten here.
  const code = mem.read8(MARIO_SPRITE_RECORD + 1);
  mem.write8(MARIO_SPRITE_RECORD + 1, (code & 0x80) | 0x7a);

  // Advance the phase 1 -> 2 and re-arm the gate long (128 ticks) so arm 2 waits.
  mem.write8(BLINK_ANIM_PHASE, (mem.read8(BLINK_ANIM_PHASE) + 1) & 0xff);
  mem.write8(SUBSTATE_TIMER, 0x80);
}
