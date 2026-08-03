// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_262f — per-frame driver for the SECOND of sub_25f2's three timed sprite objects.  ROM 0x262F.
 *
 * sub_25f2's object cascade updates three near-identical animated objects in a row
 * (loc_2602 / loc_262f / sub_2679); this is the second. Its state lives at
 * M50_OBJ2_REVERSE_TIMER / M50_OBJ2_STEP_DIR (0x62A2/0x62A3), and — like the whole
 * cascade — it is board-2 gated (`rst 0x30` mask 0x02) and never runs in attract.
 *
 * Each frame it chooses one of two arms by Mario's vertical position, then runs the
 * shared publish/animate tail loc_264c:
 *
 *   - When Mario is HIGH on the screen — MARIO_Y below the 0xC0 threshold — hand straight
 *     to loc_266f, which forces object-2's step-direction latch negative before the tail.
 *   - When Mario is at or below that threshold, run object-2's own reverse-timer:
 *       · On ODD frames, skip the timer entirely and drop into the shared tail.
 *       · On EVEN frames, tick M50_OBJ2_REVERSE_TIMER down. On the single frame it
 *         underflows past 0, reload it to its period (0xC0) and REVERSE object-2's
 *         step-direction sign (reverseStepDirection: M50_OBJ2_STEP_DIR := +2 if it was
 *         negative, else -2). On the other even frames it just falls into the tail.
 *
 * Either arm ends in loc_264c, which reduces the latch to a ±1 unit step, publishes both
 * polarities to the mover's shadow bytes, and on every 32nd frame advances object-2's
 * mirrored sprite pair. So the direction Mario-high forces negative and the even-frame
 * timer periodically flips, while the tail delivers the resulting step to the 50m mover.
 *
 * REGISTER-ABI MARSHALLING: loc_266f and loc_264c address their cells directly (they take
 * no register input), so nothing is marshalled before them; reverseStepDirection reads its
 * target pointer from HL, so this routine loads HL = M50_OBJ2_STEP_DIR before it — exactly
 * what the oracle's call site loads.
 *
 * NAME: kept the neutral loc_ — the mechanism (Mario-position-gated timer/reverse driver
 * for the second 50m object) is pinned to the oracle, but WHICH on-screen object it steers
 * is board-2 ungrounded (the sprite-record caution that keeps loc_2602/264c/266f and the
 * rest of the M50 family neutral). Promote once corroborated on a real 50m board. Not a
 * leaf — it calls loc_266f (0x266F), reverseStepDirection (0x26DE), and loc_264c (0x264C),
 * all idiomatic.
 *
 * Memory-equivalent to the frozen oracle — equivalence-262f.test.js.
 * GATE:     crafted-entry; attract never dispatches 0x262F (0× / 2500 frames, asserted —
 *           the sub_25f2 object cascade runs only in real 50m gameplay), so real states are
 *           reproduced by pokes on a booted machine: a full 256-value FRAME sweep across
 *           both Mario-position arms and both latch signs; an all-256 reverse-timer sweep
 *           (both signs) exercising the underflow reload + reverse arm; and crafted entries
 *           driving each of the four arms with effect assertions.
 * LIVE-OUT: memory-only. Every exit is a tail-call into loc_264c (directly or through
 *           loc_266f); its successor reloads the accumulator before reading it, so A/HL/
 *           flags are dead ABI. The oracle's single net caller-return `ret` is modelled by
 *           the JS return (the harness does one m.ret() to line pc + SP up with the oracle).
 * NAMES:    MARIO_Y (0x6205), FRAME (0x601A), M50_OBJ2_REVERSE_TIMER (0x62A2),
 *           M50_OBJ2_STEP_DIR (0x62A3) — all from ram.js.
 */

import { MARIO_Y, FRAME, M50_OBJ2_REVERSE_TIMER, M50_OBJ2_STEP_DIR } from "./ram.js";
import { loc_266f } from "./loc_266f.js"; // ROM 0x266F — force the latch negative, then the tail
import { reverseStepDirection } from "./reverseStepDirection.js"; // ROM 0x26DE — flip the latch sign
import { loc_264c } from "./loc_264c.js"; // ROM 0x264C — the shared publish/animate tail

export function loc_262f(m) {
  const { regs, mem } = m;

  // Mario high on the screen (smaller Y): force object-2's step-direction negative on the
  // shared tail. (`cp 0xC0 / jp c` — the branch is taken when Mario's Y is below 0xC0.)
  if (mem.read8(MARIO_Y) < 0xc0) {
    return loc_266f(m);
  }

  // At or below the threshold. Only run the reverse-timer on EVEN frames; an odd frame drops
  // straight into the shared tail.
  if ((mem.read8(FRAME) & 0x01) !== 0) {
    return loc_264c(m);
  }

  // Even frame: tick object-2's reverse-timer down. Until it underflows, run the tail as-is.
  const next = (mem.read8(M50_OBJ2_REVERSE_TIMER) - 1) & 0xff;
  mem.write8(M50_OBJ2_REVERSE_TIMER, next);
  if (next !== 0) {
    return loc_264c(m);
  }

  // Underflowed: reload the timer's period and reverse object-2's step-direction sign before
  // the shared tail. reverseStepDirection reads/writes the latch at (HL).
  mem.write8(M50_OBJ2_REVERSE_TIMER, 0xc0);
  regs.hl = M50_OBJ2_STEP_DIR;
  reverseStepDirection(m);
  return loc_264c(m);
}
