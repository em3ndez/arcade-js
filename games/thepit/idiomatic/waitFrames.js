// SPDX-License-Identifier: GPL-3.0-only
/**
 * waitFrames — pause for a fixed number of video frames, then return.  ROM 0x4bff.
 *
 * Several boot and round-transition steps need to hold for a set number of frames
 * — to leave a title on screen, let a fanfare finish, or space out a multi-step
 * setup. This is that pause. It stows the caller's frame count in the per-frame
 * countdown cell, switches the per-frame interrupt on (its service routine ticks
 * that countdown down by one every frame), then sits in a tight loop until the
 * countdown reaches zero and returns. Every pass through the loop kicks the
 * watchdog, so a long wait never looks like a lockup and trips a reset. A count of
 * zero falls straight through — no wait — but still makes one pass, so the watchdog
 * is kicked even then.
 *
 * The frame count arrives in the machine register the still-translated callers
 * leave it in — a genuine oracle boundary — so it is read off the machine rather
 * than taken as a parameter, and the exit pops back to the caller the same way.
 * Nothing here decrements the countdown: in the live game the per-frame interrupt
 * does, so this loop's termination is driven by memory it never writes itself. Run
 * in isolation there is no interrupt, so the test models that once-per-frame tick
 * identically on both sides to let the wait terminate.
 *
 * Memory-equivalent to the frozen oracle — equivalence-4bff.test.js.
 * GATE:     crafted-harness — the once-per-frame countdown tick (the interrupt's
 *           job in the live game) is modelled by one identical hook on both sides so
 *           the busy-wait terminates. EQUAL over a frame-count sweep {0,1,2,60,255}
 *           on the real boot dispatch state; count 0 is also proven with no hook
 *           (natural fall-through). Reached from boot (loc_01a4) onward.
 * LIVE-OUT: memory-only — the countdown cell (0x8009) left at 0, plus the return to
 *           the caller (pc/SP). The count and flags the loop leaves behind are dead:
 *           every caller reloads a fresh value before it reads one.
 * NAMES:    none apply — 0x8009 (the per-frame countdown cell) is unnamed in ram.js;
 *           0xb000 (interrupt-enable latch) and 0xb800 (watchdog kick) are I/O
 *           addresses, not work RAM.
 */
export function waitFrames(m) {
  const { regs, mem } = m;

  // Arm the countdown with the caller's frame count, then enable the per-frame
  // interrupt whose service routine decrements that countdown once per frame.
  mem.write8(0x8009, regs.a);
  mem.write8(0xb000, 1);

  // Spin until the countdown has been ticked all the way down to zero, kicking the
  // watchdog on every pass. Always makes at least one pass, so a zero count still
  // kicks the watchdog once before falling through.
  let remaining;
  do {
    mem.read8(0xb800); // kick the watchdog
    remaining = mem.read8(0x8009); // reload the countdown the interrupt is ticking
  } while (remaining !== 0);

  return m.ret();
}
