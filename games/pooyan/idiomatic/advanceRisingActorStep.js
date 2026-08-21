// SPDX-License-Identifier: GPL-3.0-only
/**
 * advanceRisingActorStep — per-frame step for a rising actor (state 6). Reloads the short
 * frame delay, bumps the frame counter and flips the display tile every 4th frame, and
 * drives the rise position upward. While the rise stays below the top (0xc0) it returns
 * early; once it reaches the top it nudges the base Y down 3, advances to the next state,
 * and seeds a long inter-state delay.
 *
 * LIVE-OUT: memory only (the actor record at IX); no register or flag survives the call.
 */
export function advanceRisingActorStep(m, rec = m.regs.ix) {
  const { mem8 } = m;

  mem8[rec + 0x11] = 0x02; // short per-frame delay reload

  mem8[rec + 0x0b] = mem8[rec + 0x0b] + 1;
  if ((mem8[rec + 0x0b] & 0x03) === 0) {
    // every 4th frame: toggle the display tile between 0x15 and 0x1e
    mem8[rec + 0x0f] = mem8[rec + 0x0f] === 0x15 ? 0x1e : 0x15;
  }

  mem8[rec + 0x06] = mem8[rec + 0x06] + 1;
  if (mem8[rec + 0x06] < 0xc0) return; // still rising -- nothing more this frame

  // reached the top: nudge base Y down 3, advance the state, seed the long delay
  mem8[rec + 0x04] = mem8[rec + 0x04] - 0x03;
  mem8[rec + 0x02] = mem8[rec + 0x02] + 1;
  mem8[rec + 0x11] = 0x40;
}
