// SPDX-License-Identifier: GPL-3.0-only
import { FRAME_DELAY_TIMER } from "./names.js";

// waitFrames — the machine's primitive "wait N displayed frames" delay.
//
// WHAT IT IS
//   Seeds the one-byte frame-delay counter with `a` and then spins, yielding once per displayed frame,
//   until the counter has been drained back to zero. On return exactly `a` vblank frames have elapsed
//   (a == 0 returns at once — the "!= 0" test fails on entry, so no frames elapse; the ROM's pre-test
//   loop at 0x0ad7 rets immediately in the same case).
//
// ROLE IN THE MACHINE
//   The counter is FRAME_DELAY_TIMER (0x20c0). The original 8080 code is a busy-wait: it stores the
//   count and loops reading the cell while the vblank interrupt body (loc_0010) decrements it once each
//   frame (the `dcr m` at 0x20c0). There is no CPU clock in this port, so the busy-wait is expressed as
//   a generator whose every `yield` marks one frame boundary; the runtime fires the vblank NMI at each
//   yield, and that NMI is what ticks the counter down — reproducing the ROM's frame-paced delay without
//   a cycle counter. This is the base primitive the attract sequence and round setup pace on: the typed
//   text run (typePacedSpriteRun), the round-start splash, and the next-round handoff all rest on this
//   same FRAME_DELAY_TIMER busy-wait.
//
// ROM 0x0ad7.  Grounding: [seen].
//
// LIVE-OUT: none read back by callers — memory-only (the counter ends at 0).
export function* waitFrames(m, a) {
  // Arm the countdown: publish the requested frame count into the shared timer cell the vblank ISR
  // decrements. Nothing else this routine does touches the count — the interrupt owns the decrement.
  m.mem8[FRAME_DELAY_TIMER] = a;
  // Hold until the interrupt has drained the counter to zero. Each yield surrenders the rest of this
  // frame; on resume (next frame) the ISR has already ticked the cell down by one, so the loop exits
  // after `a` frames. A seeded value of 0 never satisfies the "!= 0" test on entry and returns at once.
  while (m.mem8[FRAME_DELAY_TIMER] !== 0) yield;
}
