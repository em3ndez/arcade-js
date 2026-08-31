// SPDX-License-Identifier: GPL-3.0-only
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { armEnemyTurnAnimation } from "./armEnemyTurnAnimation.js";
import { blankEnemyBandOnTimerExpiry } from "./blankEnemyBandOnTimerExpiry.js";
import { COUNTDOWN_EXPIRE_DISPLAY_CMD, ANIM_SEQ_TABLE_3E49 } from "./names.js";
/**
 * advanceEnemyAnimationPhase — the animation-phase advancer for one enemy/object record.
 *
 * WHAT IT IS
 * Every enemy and spawned object in the arena is an actor record with a small "sub-state"
 * byte at rec+0x02. Once per frame a dispatcher routes each active record to the handler for
 * its current sub-state. This is the handler for sub-state 9. Its job is to PACE the object's
 * animation: while the object holds a pose it runs a per-frame frame timer down, and when that
 * timer lapses it steps the object to its next animation phase — repainting its tiles, and at
 * one particular phase swapping the object onto a whole new animation sequence — before
 * promoting the record's sub-state so the following frame runs the next handler.
 *
 * ROLE IN THE MACHINE
 * Reached two ways: dispatched as index 9 of the object state jump table (ROM 0x339b), and by
 * fall-through from the sub-state-8 handler armEnemyState8Animation, which drops straight into
 * this body. On a frame where the frame timer lapses it emits a display command (so the display
 * interpreter repaints the object's tiles for the new phase), may re-point the record at a fresh
 * animation sequence, then advances the record into sub-state 10 and immediately runs that
 * handler, blankEnemyBandOnTimerExpiry, this same frame.
 *
 * The record pointer arrives in IX (the `rec` argument).
 *
 * ROM: 0x3d5c-0x3d8e.
 * Grounding: [seen].
 *
 * LIVE-OUT: none — every reachable exit is memory-only (the fall-through always hits the state-10
 * handler's not-elapsed path, the timer already spent; the turn/select handler declares none; the
 * early return is memory-only).
 */

// Record field offsets (relative to the record base in `rec`):
const FRAME_TIMER = 0x11; //   rec: per-frame animation down-counter; a phase transition only fires the frame it reaches 0
const ANIM_PHASE = 0x16; //    rec: current animation phase — the value read/tested to branch below
const PHASE_COUNT = 0x13; //   rec: animation-phase counter; gets phase+1 when a phase step lands
const STATE_FIELD = 0x02; //   rec: object sub-state byte; bumped 9 -> 10 to hand the record to the next handler

// Phase sentinels and the reseed value:
const TURN_PHASE = 0x07; //    terminal "turn/select" phase — hands off instead of stepping
const SWAP_PHASE = 0x04; //    phase at which the object switches to a fresh animation sequence
const RESEED_TIMER = 0x30; //  frame-timer reload given to the swapped-in sequence

export function advanceEnemyAnimationPhase(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Tick the object's current animation one frame no matter what the phase timer does below:
  // this walks the active animation sequence (its own frame-hold countdown + script step over the
  // {tile,colour,delay} entries), keeping the current pose cycling on screen.
  advanceObjectAnimationFrame(m, rec); // step the animation sequence

  // Run the per-frame phase timer (rec+0x11) down by one, wrapping as an 8-bit value, and store it
  // back. While it is still nonzero the object stays in its current animation phase — the pose keeps
  // cycling but no phase transition happens this frame — so bail out early.
  const timer = (mem8[rec + FRAME_TIMER] - 1) & 0xff;
  mem8[rec + FRAME_TIMER] = timer;
  if (timer !== 0) return; // frame timer still running

  // The timer lapsed: it is time to step the animation phase. Read the current phase (rec+0x16).
  // Phase 7 is the terminal turn/select phase: hand the whole record to armEnemyTurnAnimation, which
  // enters its turn/select animation state. This exit does NOT bump the phase/state bookkeeping below.
  const phase = mem8[rec + ANIM_PHASE];
  if (phase === TURN_PHASE) return armEnemyTurnAnimation(m, rec);

  // For every other phase, post a repaint. The display-command word is the type-0x03 base 0x0312 with
  // its low byte biased by the phase: phase 0 uses no bias, otherwise phase-1. Adding the bias walks
  // the low byte (0x12, 0x12+1, ...) so the interpreter picks the tile set for this phase, then the
  // command is dropped into the page-0x88 display-command ring for the display interpreter to execute.
  const bias = phase === 0 ? 0 : (phase - 1) & 0xff; // display-cmd low-byte bias
  enqueueDisplayCommand(m, COUNTDOWN_EXPIRE_DISPLAY_CMD + bias);

  // At phase 4 the object does not merely repaint — it switches to a whole new animation. Look up the
  // animation-sequence pointer for this phase from the ROM word table at 0x3e49 (indexed by phase),
  // point the record at it and restart it via setActorAnimation, then reseed the frame timer to 0x30
  // so the freshly-installed sequence gets a full dwell before the next phase step.
  if (phase === SWAP_PHASE) {
    const animPtr = fetchWordFromTableIndex(m, phase, ANIM_SEQ_TABLE_3E49);
    setActorAnimation(m, rec, animPtr);
    mem8[rec + FRAME_TIMER] = RESEED_TIMER;
  }

  // Record that the object advanced one animation phase: store phase+1 into the phase counter
  // (rec+0x13); the 8-bit store truncates any carry.
  mem8[rec + PHASE_COUNT] = phase + 1; // write truncates
  // Promote the object's sub-state byte (rec+0x02) from 9 to 10 so later frames run the next handler.
  mem8[rec + STATE_FIELD] = mem8[rec + STATE_FIELD] + 1;
  // Fall straight into the sub-state-10 handler this same frame. Because the frame timer was just spent
  // (or reseeded high on the swap path), that handler takes its not-elapsed path and returns memory-only.
  return blankEnemyBandOnTimerExpiry(m, rec); // fall through into the state-10 handler
}
