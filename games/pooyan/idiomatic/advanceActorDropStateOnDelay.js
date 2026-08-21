// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceActorDropStateOnDelay — one step of an actor's drop/settle phase: count down the
 * per-frame delay at +0x11, and only at zero nudge the actor down, restamp its display tile,
 * reseed the delay, and advance it to the next dispatch state.
 *
 * LIVE-OUT: memory only — the record fields at IX. The caller (a state dispatcher) reads no
 * register or flag, so the early-return path's leftover decrement flags don't matter.
 */
export function advanceActorDropStateOnDelay(m, rec = m.regs.ix) {
  const { mem8 } = m;

  mem8[rec + 0x11] = mem8[rec + 0x11] - 1;
  if (mem8[rec + 0x11] !== 0) return;

  mem8[rec + 0x04] = mem8[rec + 0x04] + 0x04;
  mem8[rec + 0x06] = mem8[rec + 0x06] - 0x08;
  mem8[rec + 0x0f] = 0x1a;
  mem8[rec + 0x11] = 0x30;
  mem8[rec + 0x02] = mem8[rec + 0x02] + 1;
}
