// SPDX-License-Identifier: GPL-3.0-only
/**
 * stepObjectFromControl — advance the tracked object one frame from its control input.  ROM 0x1420.
 *
 * The last arm of the per-frame object/state dispatcher: once every earlier gate has
 * passed (the object is active, at rest, and not on a special tile), this is where the
 * tracked object (the one PLAYER_Y/PLAYER_X locate) takes its ordinary per-frame move.
 *
 *   - If a reaction animation currently owns the object — a collision/dig/push reaction
 *     is armed and playing — the ordinary move is deferred for this frame: instead of
 *     moving, stage the object's deferral record and stop.
 *   - Otherwise pick the move command that drives the object this frame — the attract
 *     demo's generated steering while the demo is running (game mode 3 and up), the
 *     debounced joystick during real play — and hand it to the per-frame update
 *     dispatcher, which positions, animates, or stands the object still accordingly.
 *
 * So the demo's steering is consumed here exactly where the joystick would be: the same
 * downstream dispatcher runs either way, only the source of its command differs.
 *
 * Memory-equivalent to the frozen oracle — equivalence-1420.test.js.
 * GATE:     crafted-entry — both live arms occur naturally in attract over 2500 frames
 *           (the reaction-defer arm and the demo-steer arm); only the joystick arm never
 *           runs (real play, game mode < 3), so it is gated on a real entry with the
 *           game-mode byte poked below 3. Full-RAM diff, no exclusion window (the delegated
 *           handlers only read the return address off the stack, never write it); pc, SP
 *           and the dead value registers are excluded.
 * LIVE-OUT: memory-only — every effect is produced by the delegated handler (the per-frame
 *           update dispatcher or the deferral-record staging); this routine writes no RAM
 *           of its own, and its caller tail-jumps here and reads no register back.
 * NAMES:    REACTION_STATE, GAME_STATE, DEMO_STEER_DIR, IN0_DEBOUNCED from names.js.
 */

import { REACTION_STATE, GAME_STATE, DEMO_STEER_DIR, IN0_DEBOUNCED } from "./names.js";
import { advanceObjectFrame } from "./advanceObjectFrame.js";
import { stageObjectSpriteRecord } from "./stageObjectSpriteRecord.js";

export function stepObjectFromControl(m) {
  const { mem8, regs } = m;

  // A reaction animation currently owns the object -> defer its move this frame and
  // stage the object's deferral record instead.
  if (mem8[REACTION_STATE] !== 0) return stageObjectSpriteRecord(m);

  // Pick the move command: the demo's generated steering while the attract demo runs,
  // the debounced joystick during real play.
  const runningDemo = mem8[GAME_STATE] >= 3;
  regs.a = runningDemo ? mem8[DEMO_STEER_DIR] : mem8[IN0_DEBOUNCED];

  // Hand the command to the per-frame update dispatcher, which positions, animates, or
  // stands the object still. It reads the command from the slot the caller fills, so
  // setting it here is the sanctioned boundary into that still-register-ABI routine.
  return advanceObjectFrame(m);
}
