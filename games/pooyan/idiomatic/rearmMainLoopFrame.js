// SPDX-License-Identifier: GPL-3.0-only

// The object-freeze integrity gate, run once per frame when the round counter asks for it.
import { guardObjectFreezeIntegrity } from "./guardObjectFreezeIntegrity.js";
// The frame-setup sound enqueue: pushes the fixed run of sound-command bytes into the
// audio-CPU command ring so the setup jingle plays as the frame is armed.
import { queueSoundRun28 } from "./queueSoundRun28.js";
// The heart of active play: the fixed ten-step per-frame worker chain (HUD, input, spawns,
// object sweep, display-list rebuild, sound drain). Sub-state 0 shares it by handing off here.
import { runActivePlayFrame } from "./runActivePlayFrame.js";
import {
  // 0x8901 -- per-stage countdown; its reload value is what this handler re-seeds each frame.
  STAGE_COUNTDOWN,
  // 0x8907 -- the HUD round number; bit 2 is the "run the integrity walker this frame" request.
  ROUND_COUNTER,
  // 0x8f61 -- launch-state flip latch; when set, the spawn path bumps a sub-counter instead
  // of enqueuing the hunter-spawn display command.
  HUNTER_SPAWN_FLIP_FLAG,
  // 0x8f3f -- one-shot arm flag for the arrow/formation launch.
  LAUNCH_ARMED_FLAG,
  // 0x8f5c -- the main-loop sub-state selector (&7) that the top-level dispatcher reads to
  // choose this frame's handler; this routine both re-arms it and, on promotion, overwrites it.
  MAINLOOP_SUBSTATE_SELECTOR,
  // 0x8a38 -- read here as the pending sub-state byte: zero means "nothing scheduled".
  TAMPER_STRIKES_SIG,
} from "./names.js";

/**
 * rearmMainLoopFrame -- main-loop sub-state 0: re-arm the frame, then idle or run a full frame.
 *
 * WHAT IT IS
 *   The ordinary play loop is a six-way state machine driven by MAINLOOP_SUBSTATE_SELECTOR
 *   (0x8f5c) & 7. State 0 -- this routine -- is the re-arm / setup state. Every frame it
 *   resets the stage countdown, optionally runs the object-freeze integrity walker, re-arms
 *   the three per-frame latches, and enqueues the frame-setup sound run. It then consults a
 *   pending sub-state byte: if nothing is scheduled it returns (an idle re-arm); otherwise it
 *   promotes that value into the selector and runs one complete active-play worker frame by
 *   handing off to runActivePlayFrame -- the same ten-step chain sub-state 1 runs.
 *
 * ROLE IN THE MACHINE
 *   This is the state the loop rests in between scheduled work: it keeps the countdown, the
 *   launch latches, and the selector primed so that the moment something schedules a sub-state
 *   (by writing a non-zero pending byte), a full frame runs immediately under it.
 *
 * ROM 0x0fef.
 * Grounding: [seen]
 *
 * LIVE-OUT: memory only. STAGE_COUNTDOWN reloaded; the three latches set to 1; the selector
 *   set to 1 (idle) or to the promoted pending value; plus every memory effect of the integrity
 *   walker, the sound enqueue, and -- on promotion -- the whole worker chain. No register output.
 */

// The value STAGE_COUNTDOWN (0x8901) is re-seeded to each frame; its initial value also
// selects the stage label drawn on the HUD.
const STAGE_RELOAD = 0x0f;
// Mask for ROUND_COUNTER (0x8907) bit 2: when set, this frame must run the integrity walker.
const ROUND_BIT2 = 0x04;

export function rearmMainLoopFrame(m) {
  const { mem8 } = m;

  // Re-seed the per-stage countdown at 0x8901 to its reload value at the top of every frame,
  // so the stage timer restarts from a known point while this re-arm state holds.
  mem8[STAGE_COUNTDOWN] = STAGE_RELOAD;
  // ROUND_COUNTER (0x8907) bit 2 is the round's request to audit object state this frame. When
  // set, run guardObjectFreezeIntegrity, which traps if the object-freeze flag is up and
  // otherwise delegates to the phase-4 tilemap checksum guard.
  if (mem8[ROUND_COUNTER] & ROUND_BIT2) guardObjectFreezeIntegrity(m);

  // Re-arm the three per-frame latches to 1, then enqueue the frame-setup sound run.
  //   HUNTER_SPAWN_FLIP_FLAG (0x8f61) -- primes the launch-state flip path,
  //   LAUNCH_ARMED_FLAG      (0x8f3f) -- re-arms the arrow/formation launch,
  //   MAINLOOP_SUBSTATE_SELECTOR (0x8f5c) -- default the loop back to sub-state 1 (active play)
  //     unless a pending sub-state overrides it below.
  // queueSoundRun28 then pushes the fixed setup sound-command bytes into the audio-CPU ring.
  mem8[HUNTER_SPAWN_FLIP_FLAG] = 1;
  mem8[LAUNCH_ARMED_FLAG] = 1;
  mem8[MAINLOOP_SUBSTATE_SELECTOR] = 1;
  queueSoundRun28(m);

  // Read the pending sub-state byte at 0x8a38 (TAMPER_STRIKES_SIG). Zero means nothing is
  // scheduled: the frame ends here as a pure re-arm/idle. A non-zero value is a sub-state to
  // promote -- latch it into MAINLOOP_SUBSTATE_SELECTOR (overriding the default 1 above) and
  // fall straight into runActivePlayFrame, running one complete ten-step worker frame under it.
  const pending = mem8[TAMPER_STRIKES_SIG];
  if (pending === 0) return;
  mem8[MAINLOOP_SUBSTATE_SELECTOR] = pending;
  runActivePlayFrame(m);
}
