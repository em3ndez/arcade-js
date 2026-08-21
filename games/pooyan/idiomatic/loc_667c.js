// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_667c — advance one actor while its state byte is idle, retiring it at the top row.
 *
 * Runs only while (IX+1) is 0. Adds the per-frame step (IX+9) into the sub-position
 * (IX+5); an 8-bit overflow carries one whole row into (IX+6). Once that row reaches the
 * retire row the record is retired — state (IX+1)=2 with (IX+4) and (IX+6) cleared;
 * below it the routine returns.
 *
 * LIVE-OUT: memory only — the caller reads no register or flag back.
 */

const RETIRE_ROW = 0x1d;
const ACTOR_RETIRED_STATE = 0x02;

export function loc_667c(m, rec = m.regs.ix) {
  const { mem8 } = m;
  if (mem8[rec + 0x01] !== 0) return;

  const sum = mem8[rec + 0x05] + mem8[rec + 0x09];
  if (sum > 0xff) mem8[rec + 0x06] = mem8[rec + 0x06] + 1;
  mem8[rec + 0x05] = sum;

  if (mem8[rec + 0x06] < RETIRE_ROW) return;

  mem8[rec + 0x01] = ACTOR_RETIRED_STATE;
  mem8[rec + 0x04] = 0;
  mem8[rec + 0x06] = 0;
}
