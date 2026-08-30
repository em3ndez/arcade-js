// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceActorDropStateOnDelay — run one tick of an actor's drop/settle phase: wait out a
 * per-frame delay, and only when it elapses nudge the actor downward, restamp its shape, reseed the
 * delay, and move it on to the next state.
 *
 * ROM 0x24db-0x24fa. Grounding: [seen].
 *
 * ROLE. Actors in the 0x8a80 record arena (stride 0x18) advance through a sequence of numbered
 * states; each tick, a state dispatcher calls the handler for the actor's current state. This is
 * the handler for one such state — a falling/settling step — with the actor's record base in IX.
 * The record fields it touches:
 *   +0x02  the actor's state index (which handler runs next tick).
 *   +0x04  the base Y (coarse vertical position).
 *   +0x06  a paired position byte, moved the opposite way from +0x04.
 *   +0x0f  the display tile/shape.
 *   +0x11  the frame-delay countdown that paces this state.
 *
 * The step: decrement the delay at +0x11; while it is still non-zero, do nothing more this tick. On
 * the tick it reaches zero, perform the settle: move +0x04 down by 4, move +0x06 up by 8 (an 8-bit
 * subtract, so it wraps), stamp the display tile +0x0f to 0x1a, reload the delay +0x11 to 0x30 (a
 * long hold before the next state runs), and advance the state index +0x02 by one.
 *
 * A PURE LEAF: it only reads and writes the record; it calls nothing.
 *
 * LIVE-OUT: memory only — the record fields at IX. The caller reads no register or flag back, so
 * the leftover flags from the early-return decrement path do not matter.
 */
export function advanceActorDropStateOnDelay(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Pace the state: tick the frame-delay countdown down by one. Until it hits zero, this state just
  // marks time — return without touching the actor's position or state.
  mem8[rec + 0x11] = mem8[rec + 0x11] - 1;
  if (mem8[rec + 0x11] !== 0) return;

  // Delay elapsed — perform the settle for this state:
  mem8[rec + 0x04] = mem8[rec + 0x04] + 0x04; // move base Y down by 4
  mem8[rec + 0x06] = mem8[rec + 0x06] - 0x08; // move the paired byte up by 8 (8-bit, wraps)
  mem8[rec + 0x0f] = 0x1a; // stamp the settled display tile
  mem8[rec + 0x11] = 0x30; // reseed a long frame-delay before the next state
  mem8[rec + 0x02] = mem8[rec + 0x02] + 1; // advance to the next dispatch state
}
