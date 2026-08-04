// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepMarioDeathAnimation — phase-1 arm of Mario's DEATH ANIMATION: on each 8-frame gate tick step
 * his sprite to the next of four orientations, and when the 13 ticks run out settle it and
 * advance the phase.  ROM 0x12AC.
 *
 * One of the three arms of the phase state machine dispatched by dispatchDeathAnimationPhase
 * (the rst-0x28 table at ROM 0x1283, selector DEATH_ANIM_PHASE 0x639D): arm 0
 * (beginMarioDeathAnimation) seeds the animation and the 13-tick count, this arm (phase == 1) runs the
 * cycle, arm 2 (loc_12de) hands off to the life-loss sub-state. It is gated by the sub-state
 * timer so it acts only on the frames that gate expires:
 *
 *   - The `rst 0x18` gate (tickSubstateTimer) ticks SUBSTATE_TIMER (0x6009). While it
 *     is still counting down the arm is skipped this frame — the Z80 caller-skip,
 *     modelled as a plain early return on the callee's `false`. On expiry the timer is
 *     reloaded to 8 (the fixed 8-FRAME tick cadence).
 *   - Decrement DEATH_ANIM_TICKS_LEFT (0x639E). If it has NOT yet reached zero, step
 *     Mario's sprite record (0x694D/0x694E): flip bit 0 of the sprite-code byte every tick
 *     (the tile alternates 0x78 <-> 0x79) and, on the tick that bit 0 falls back to 0, also
 *     flip bit 7 of the sprite-code byte (flipy) and bit 7 of the attribute byte (flipx).
 *     Those two flips together are a 180-degree rotation. Then return.
 *   - When the count reaches zero (DEATH_ANIM_TICKS_LEFT was 1), advance instead: rewrite the
 *     sprite-code byte to a fixed 0x7A (its old bit 7 preserved, so 0xFA if it was set),
 *     bump the phase DEATH_ANIM_PHASE (0x639D) 1 -> 2, and reload the gate long (0x80 = 128
 *     ticks) so arm 2 fires only after a pause.
 *
 * NAME — GROUNDED, and corroborated from OUTSIDE this routine (R5). Live MAME 0.288 on the
 * real dkong ROM (scratchpad/pass13-grounding.md §2): 136,367 logged frames, positive control
 * ≈1 NMI fetch per frame, 44 episodes of which 43 completed and are byte-identical. This arm
 * is the one that produces the observed shape: 0x639E steps 13,12,…,0 at pc 0x12B6, one per
 * 8-frame gate tick (143 post-gate body fetches = 13 × 11 episodes in one run, with 11
 * settles at 0x12CB — no strays), and Mario's record takes exactly four (code, attr) pairs —
 * 0xF8/0x02, 0xF9/0x02, 0x78/0x82, 0x79/0x82 — each held 8 frames and cycled 3 times, before
 * the settle write lands 0x7A (or 0xFA when the facing bit was set) on 43/43. The outside
 * evidence: MARIO_SPRITE_RECORD (0x694C) is a [seen] cell in names.js and the sprite-record
 * layout comes from MAME's own dkong_v.cpp draw_sprites (byte +1 = flipy|code, byte +2 =
 * flipx|…, transcribed at boards/dkong/video.js:657), which is what makes the two flip bits a
 * ROTATION rather than an arbitrary pair; both animation cells are [seen] in names.js; and the
 * 296-frame episode length this arm dominates ends with a life lost (15 deaths, 15 LIVES
 * decrements in the following sub-state). ★ NEGATIVE CONTROL: 42,275 frames of ordinary play
 * with 0x639D and 0x639E both 0 on every frame, and zero 0x639E transitions in all 87,142
 * non-cluster frames.
 * WHAT THE NAME DOES NOT CLAIM. It does not claim a cause — the animation is not conditional
 * on MARIO_ACTIVE (0x6200) being 0; the bonus-timer-expiry death reaches the same instructions
 * with it still 1 (ROM 0x1A2A jumps into the middle of them at 0x19D2, stepping over the
 * MARIO_ACTIVE test). It makes NO PIXEL CLAIM: pass 13 ran `-video none`, so what is grounded
 * is the four (code, attr) pairs and the 0x7A settle byte — not how the orientation cycle looks on
 * screen, and not what tiles 0x78/0x79/0x7A depict. And it does not claim to end the life:
 * arm 2 hands that to the next sub-state.
 *
 * Sole callee: tickSubstateTimer (rst 0x18, 0x0018), the idiomatic version, called
 * directly. No other calls; the Z80 `ret` is the caller-skip's single net return, which
 * the equivalence harness supplies (this routine models no stack).
 *
 * Memory-equivalent to the frozen oracle — equivalence-12ac.test.js.
 * GATE:     crafted-entry — 104 real attract dispatches over 3000 frames (91 skip-arm
 *           from frame ~2619, 12 step-arm from ~2626, 1 advance-arm from ~2722, all
 *           identical) + crafted step/advance/skip arms poked from a real capture so
 *           every arm is covered regardless of timing. Teeth: a wrong sprite store and a
 *           gate-polarity inversion, both caught. Compared vs the oracle over RAM
 *           (−STACK_SCRATCH) + pc + SP. COVERAGE HOLE, stated plainly (R17): the captures
 *           come from an ATTRACT run only — the identical in-game (GAME_SUBSTATE 0x0D)
 *           episodes are not replayed here.
 * LIVE-OUT: memory-only — SUBSTATE_TIMER (0x6009), the tick counter DEATH_ANIM_TICKS_LEFT (0x639E),
 *           the phase DEATH_ANIM_PHASE (0x639D), and the sprite record 0x694D/0x694E
 *           (MARIO_SPRITE_RECORD +1/+2). Dispatched from the rst-0x28
 *           table inside the vblank NMI, whose tail reads none of its registers; the
 *           oracle's residual A/B/HL and flags are dead ABI (pc/SP model the single
 *           caller-skip return the harness reconciles).
 * NAMES:    SUBSTATE_TIMER (0x6009), MARIO_SPRITE_RECORD (0x694C), DEATH_ANIM_PHASE
 *           (0x639D), DEATH_ANIM_TICKS_LEFT (0x639E) — from names.js (the last two now [seen],
 *           grounded on the pass-13 MAME runs). 0x694D/0x694E are MARIO_SPRITE_RECORD +1/+2.
 */

import { SUBSTATE_TIMER, MARIO_SPRITE_RECORD, DEATH_ANIM_PHASE, DEATH_ANIM_TICKS_LEFT } from "./names.js";
import { tickSubstateTimer } from "./tickSubstateTimer.js";

// The two animated cells: sprite-code byte (+1, bit 7 = flipy) and attribute byte
// (+2, bit 7 = flipx) of Mario's hardware sprite record at 0x694C.
const SPRITE_CODE = MARIO_SPRITE_RECORD + 1; // 0x694D
const SPRITE_ATTR = MARIO_SPRITE_RECORD + 2; // 0x694E

export function stepMarioDeathAnimation(m) {
  const { mem } = m;

  // rst 0x18 gate: until SUBSTATE_TIMER expires this frame, skip the arm entirely
  // (the Z80 caller-skip, now a plain early return on `false`).
  if (!tickSubstateTimer(m)) return;

  // Gate expired -> reload it to the 8-frame tick cadence.
  mem.write8(SUBSTATE_TIMER, 0x08);

  // Count down the 13 ticks; a zero result means the cycle is over.
  const remaining = (mem.read8(DEATH_ANIM_TICKS_LEFT) - 1) & 0xff;
  mem.write8(DEATH_ANIM_TICKS_LEFT, remaining);
  if (remaining === 0) {
    advancePhase(m);
    return;
  }

  // --- step: advance the sprite at 0x694D/0x694E to the next orientation ---
  // The sprite-code byte's bit 0 flips every tick (tile 0x78 <-> 0x79). `b` carries
  // that flip in bit 0 (always set) and the code's OLD bit 0 in bit 7, so XORing `b`
  // into the code toggles bit 0 always and bit 7 (flipy) only on the tick bit 0 falls to 0.
  const code = mem.read8(SPRITE_CODE);
  const b = ((code & 0x01) << 7) | 0x01; // 0x81 if old bit 0 set, else 0x01
  mem.write8(SPRITE_CODE, b ^ code);
  // The attribute byte's bit 7 (flipx) flips on that same "bit 0 fell to 0" tick (b & 0x80),
  // so flipy and flipx always swap together — the 180-degree half of the four-pair cycle.
  mem.write8(SPRITE_ATTR, (b & 0x80) ^ mem.read8(SPRITE_ATTR));
}

/**
 * The phase-advance tail (ROM 0x12CB), reached only when the tick count hits zero — the
 * SETTLE: the animation stops cycling and Mario's sprite is left on tile 0x7A (0xFA when
 * the facing bit was set), observed on 43/43 completed episodes. Reachable solely from
 * stepMarioDeathAnimation's advance branch (no external dispatch targets it), so it stays a
 * private helper rather than an export.
 */
function advancePhase(m) {
  const { mem } = m;

  // Rewrite the sprite-code byte to 0x7A, keeping its old bit 7 (-> 0xFA if it was set).
  // Mirrors the oracle's `rl (hl)` (old bit 7 -> carry) + `ld a,0xF4` + `rra`
  // (0xF4 >> 1 = 0x7A, carry -> bit 7); the rl's own store is dead, overwritten here.
  const code = mem.read8(MARIO_SPRITE_RECORD + 1);
  mem.write8(MARIO_SPRITE_RECORD + 1, (code & 0x80) | 0x7a);

  // Advance the phase 1 -> 2 and re-arm the gate long (128 ticks) so arm 2 waits.
  mem.write8(DEATH_ANIM_PHASE, (mem.read8(DEATH_ANIM_PHASE) + 1) & 0xff);
  mem.write8(SUBSTATE_TIMER, 0x80);
}
