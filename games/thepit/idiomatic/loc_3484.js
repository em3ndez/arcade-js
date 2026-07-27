// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_3484 — one fixed-direction preset of the patrol mover: step its position one
 * unit forward each frame and, on the cadence tick, re-arm the cadence and publish
 * this preset's facing index.  ROM 0x3484.
 *
 * The mover has four preset entry points that share one body, each hard-wiring a
 * direction as a position delta plus a facing index. This preset carries a +1
 * position step and facing index 2, with no cross-axis motion. Each frame it does:
 *   - Tick the cadence countdown down by one.
 *   - The frame the countdown runs out, reload it from its reload value and publish
 *     this preset's facing index (2) as the mover's current direction.
 *   - Advance the mover one unit forward along its axis — every frame, regardless of
 *     the countdown.
 * The sibling presets that carry a cross-axis step also rewrite an orientation/sprite
 * code on the cadence tick; this preset never does (its cross-axis delta is zero), so
 * that work is simply absent from the live path here.
 *
 * Entered by tail-jump from the mover dispatch (loc_319d); it leaves all of its work
 * in memory and returns to the dispatcher's caller, which copies the mover's record
 * out of memory without reading any register this routine leaves behind.
 *
 * Memory-equivalent to the frozen oracle — equivalence-3484.test.js.
 * GATE:     RAM-only; real captured attract dispatches (reached ~250×/3000 frames,
 *           spanning both the tick-only and the cadence-reload branch) + a crafted
 *           countdown sweep that forces the reload branch and its boundary + teeth.
 *           A leaf: its result is a pure function of the countdown, reload, and
 *           position bytes — it reads no register input and calls nothing.
 * LIVE-OUT: memory-only — the cadence countdown, the published facing index, and the
 *           advanced position. The oracle's residual value registers/flags are dead
 *           ABI: the caller overwrites the registers and reads the mover's record from
 *           memory, so none is consumed. The RAM gate backstops that.
 * NAMES:    ANIM_RAND (0x808b) serves as this mover's cadence countdown here; the
 *           reload MOVER_MOVE_PERIOD (0x8091). The facing (0x8092) and position (0x8086)
 *           bytes have no ram.js name yet and stay hex. The name stays neutral loc_: the effect
 *           (advance the mover, publish its facing) is clear, but the screen direction
 *           this preset encodes is not pinned to an axis, and that direction is the
 *           only thing that would distinguish an English name from its siblings.
 */

import { ANIM_RAND, MOVER_DIRECTION, MOVER_MOVE_PERIOD } from "./ram.js";

export function loc_3484(m) {
  const { mem8 } = m;

  // Tick the cadence countdown down one, every frame.
  const countdown = mem8[ANIM_RAND] - 1;
  mem8[ANIM_RAND] = countdown;

  // The frame it runs out, re-arm the cadence from its reload value and publish this
  // preset's facing index as the mover's current direction.
  if (countdown === 0) {
    mem8[ANIM_RAND] = mem8[MOVER_MOVE_PERIOD];
    mem8[MOVER_DIRECTION] = 2;
  }

  // Advance the mover one unit forward along its axis, every frame.
  mem8[0x8086] = mem8[0x8086] + 1;
}
