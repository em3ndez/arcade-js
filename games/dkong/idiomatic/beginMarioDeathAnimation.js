// SPDX-License-Identifier: GPL-3.0-only
/**
 * beginMarioDeathAnimation — the seed arm of Mario's DEATH ANIMATION: point his sprite at the
 * first death tile, prime the 13-tick counter, clear sprite runs, fire the death sound line, then
 * advance the phase.
 *
 * Arm 0 of a three-arm phase machine selected by DEATH_ANIM_PHASE: this arm seeds the animation,
 * arm 1 runs the 13 gate ticks, and arm 2 hands off to the life-loss sub-state. Like its siblings
 * it is gated by the sub-state timer, so it acts only on the frame that gate expires:
 *
 *   - The gate ticks SUBSTATE_TIMER down. While it is still counting the arm is skipped for the
 *     frame — a caller-skip on the hardware, modelled here as a plain early return.
 *   - On expiry it rewrites Mario's sprite-code byte to the fixed tile code 0x78, preserving its
 *     old bit 7 (Mario's facing flag, so 0xF8 if set) — the first of the four orientations arm 1
 *     then cycles.
 *   - It advances DEATH_ANIM_PHASE 0 -> 1 and primes DEATH_ANIM_TICKS_LEFT to 13, then re-arms the
 *     gate to 8 — the 8-frame tick cadence arm 1 runs on.
 *   - It clears four disjoint runs of sprite records, then fires the death sound by asserting
 *     SND_IRQ_TRIGGER for three frames.
 *
 * WHAT THE NAME DOES NOT CLAIM. "begin" names the START of the animation, not the cause of the
 * death: this routine does not detect, decide or perform a kill, and it does not take the life —
 * the life comes off in the following sub-state. The animation is NOT conditional on Mario being
 * flagged inactive; the bonus-timer-expiry death reaches this same sequence with MARIO_ACTIVE
 * still set. There is no pixel claim here either: tile 0x78 is a byte written into the sprite
 * record, not an observation of what is drawn, and which sprites the four cleared runs hold was
 * not separately established.
 *
 * LIVE-OUT: memory-only — Mario's sprite-code byte, DEATH_ANIM_PHASE, DEATH_ANIM_TICKS_LEFT,
 * SUBSTATE_TIMER, the cleared sprite runs and SND_IRQ_TRIGGER. Dispatched from inside the vblank
 * interrupt, whose tail reads none of the registers left behind.
 */

import {
  SUBSTATE_TIMER,
  MARIO_SPRITE_RECORD,
  SND_IRQ_TRIGGER,
  DEATH_ANIM_PHASE,
  DEATH_ANIM_TICKS_LEFT,
} from "./names.js";
import { tickSubstateTimer } from "./tickSubstateTimer.js";
import { loc_30bd } from "../translated/loc_30bd.js";

// The sprite-code byte of Mario's hardware sprite record.
const SPRITE_CODE = MARIO_SPRITE_RECORD + 1;

export function beginMarioDeathAnimation(m) {
  const { mem } = m;

  // The gate: until SUBSTATE_TIMER expires this frame, skip the arm entirely.
  if (!tickSubstateTimer(m)) return;

  // Point Mario's sprite at the first death tile: rewrite the sprite-code byte to the fixed tile
  // code 0x78, keeping its old bit 7 (Mario's facing flag, so 0xF8 if set). Preserving that
  // facing bit is why the cycle arm 1 runs comes in two flavours, one per direction.
  const code = mem.read8(SPRITE_CODE);
  mem.write8(SPRITE_CODE, (code & 0x80) | 0x78);

  // Advance DEATH_ANIM_PHASE 0 -> 1, prime the tick counter to 13, and re-arm the gate to the
  // 8-frame cadence the next arm runs on.
  mem.write8(DEATH_ANIM_PHASE, (mem.read8(DEATH_ANIM_PHASE) + 1) & 0xff);
  mem.write8(DEATH_ANIM_TICKS_LEFT, 0x0d);
  mem.write8(SUBSTATE_TIMER, 0x08);

  // Clear four disjoint runs of sprite records.
  loc_30bd(m);

  // Fire the death sound: a three-frame assert of the sound CPU's interrupt line.
  mem.write8(SND_IRQ_TRIGGER, 0x03);
}
