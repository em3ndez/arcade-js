// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { dispatchEnemyActorState } from "./dispatchEnemyActorState.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import {
  ENEMY_ACTOR_TABLE,
  WAVE_NUMBER,
  LAUNCH_FLIP_COUNTDOWN,
  FLIP_ANIM_DISPLAY_CMD,
  FLIP_ANIM_DISPLAY_CMD_ALT,
} from "./names.js";
/**
 * updateEnemyActorsAndCycleLaunchFlipAnim — step three enemy-actor records through their per-frame
 * state pass, then run the launch/flip animation cadence.
 *
 * WHAT IT IS
 *   ROM 0x66c5-0x66f0. A per-frame driver with two distinct jobs bolted together:
 *
 *     1. It advances three consecutive enemy-actor records — one animation/behaviour step each.
 *        Each record is a fixed 0x18-byte struct; the pointer passed in (IX) names the first one
 *        and successive records sit 0x18 bytes apart in the actor arena. Every record is handed to
 *        the per-record state dispatcher (dispatchEnemyActorState, ROM 0x66f1), which reads the
 *        record's state byte at +2 and routes it to the handler that owns that state, so the record
 *        advances its own little state machine by one frame. The original hardware keeps this scan
 *        cursor and the loop count parked in the CPU's alternate register set across each dispatch
 *        so the handler is free to clobber the main registers; here the cursor and count are just
 *        the local `rec` and `i`.
 *
 *     2. It then paces the launch/flip tile animation — the two-frame toggle that swaps the launch
 *        sprite between its two halves. This half runs only while the enemy table's lead record is
 *        active (see below); when it does run it is a plain divide-down timer: a countdown ticks
 *        every frame, and only when it hits zero does the animation take a step.
 *
 * ROLE IN THE MACHINE
 *   Called each worker frame as part of the enemy/launch subsystem. Job 1 keeps the on-rope enemies
 *   animating and behaving; job 2 emits the periodic display command that redraws the flip sprite,
 *   which the main loop later drains from the display-command ring (page 0x88, slots 0x88c0..0x88ff)
 *   and paints.
 *
 * GROUNDING: [seen]
 *
 * LIVE-OUT: none (memory only) — the record pointer is a local scan cursor and the caller reloads
 * IX before its next use, reading no register back. Its lasting effects are entirely in memory: the
 * countdown at WAVE_NUMBER (0x892d), the flip toggle at LAUNCH_FLIP_COUNTDOWN (0x892f), whatever the
 * three per-record handlers wrote, and the display command it may enqueue.
 */

const RECORD_STRIDE = 0x18; // one enemy-actor record is 0x18 bytes; consecutive records sit this far apart
const RECORD_COUNT = 3; // this driver steps exactly three consecutive records per frame
const LEAD_STATE_OFFSET = 0x02; // enemy table's lead state byte, gates the post-pass work
const COUNTDOWN_RELOAD = 0x10; // value the flip countdown is reloaded to on expiry (16 frames per flip step)

export function updateEnemyActorsAndCycleLaunchFlipAnim(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // ── Step 1: advance three consecutive enemy-actor records ────────────────────────────────────
  // Starting at the record pointer `rec` (IX on entry), hand each of three consecutive records to
  // the per-record state dispatcher, then step the cursor forward one record (0x18 bytes). The
  // dispatcher (ROM 0x66f1) reads the record's state byte at +2 and vectors to the handler for that
  // state, so each pass advances one record's behaviour/animation by a single frame.
  for (let i = 0; i < RECORD_COUNT; i++) {
    dispatchEnemyActorState(m, rec);
    rec = u16(rec + RECORD_STRIDE); // advance to the next 0x18-byte record (wrap to 16-bit)
  }

  // ── Step 2 gate: only cycle the flip animation while the lead enemy record is active ──────────
  // The lead byte of the enemy-actor table (ENEMY_ACTOR_TABLE 0x8ae0 + 0x02 = 0x8ae2) is the lead
  // record's state byte. If it is clear the launch/flip machinery is idle, so there is nothing to
  // animate — bail before touching the countdown or emitting any display command.
  if (mem8[ENEMY_ACTOR_TABLE + LEAD_STATE_OFFSET] === 0) return; // lead state clear -> stop

  // ── Step 3: tick the per-frame flip countdown ────────────────────────────────────────────────
  // WAVE_NUMBER (0x892d) serves here as the flip-cadence down-counter. While it is still live, just
  // decrement it and return — the flip animation only steps once the count runs out, so the toggle
  // advances once every COUNTDOWN_RELOAD (0x10) frames rather than every frame.
  if (mem8[WAVE_NUMBER] !== 0) {
    mem8[WAVE_NUMBER] = mem8[WAVE_NUMBER] - 1; // count still live
    return;
  }

  // ── Step 4: countdown expired — reload it, advance the flip toggle, and emit its display command ─
  // Reload the countdown to 0x10 so the next flip step is another 16 frames out.
  mem8[WAVE_NUMBER] = COUNTDOWN_RELOAD; // count expired -> reload
  // Bump LAUNCH_FLIP_COUNTDOWN (0x892f), the flip toggle. Its low bit alternates 0/1 on every step,
  // which is what selects between the two halves of the flip animation.
  mem8[LAUNCH_FLIP_COUNTDOWN] = mem8[LAUNCH_FLIP_COUNTDOWN] + 1; // advance the flip toggle
  // Pick the display command from the toggle's new low bit: the primary variant (0x0612) when bit0
  // is set, the alternate (0x0692) when it is clear — the two frames of the flip.
  const cmd = (mem8[LAUNCH_FLIP_COUNTDOWN] & 0x01) ? FLIP_ANIM_DISPLAY_CMD : FLIP_ANIM_DISPLAY_CMD_ALT;
  // Queue the chosen command into the page-0x88 display-command ring (via ROM 0x0038); the main loop
  // drains the ring and paints the flip sprite for this frame.
  enqueueDisplayCommand(m, cmd);
}
