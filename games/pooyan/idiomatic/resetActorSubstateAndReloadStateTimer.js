// SPDX-License-Identifier: GPL-3.0-only
/**
 * resetActorSubstateAndReloadStateTimer — reset the enemy actor's sub-state and reload its state timer.
 *
 * Clears the sub-state field (+2) to 0 and reloads the timer field (+0x11) to 0x20.
 *
 * LIVE-OUT: none — a void record write on the IX actor record.
 */
export function resetActorSubstateAndReloadStateTimer(m, rec = m.regs.ix) {
  const { mem8 } = m;
  mem8[rec + 0x02] = 0x00;
  mem8[rec + 0x11] = 0x20;
}
