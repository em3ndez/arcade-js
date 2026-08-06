// SPDX-License-Identifier: GPL-3.0-only
/** loc_2b52 — release a held object once its delay runs out. A countdown in the object
 * record's fifteenth byte ticks down by one per entry, and while it is still running that
 * tick is the whole effect; on the tick that lands it on zero the record's first byte —
 * the code a slot is held in — steps on by one, and the countdown cell reloads with 128.
 * LIVE-OUT: memory only — one cell every entry, two on the entry that releases. */

import { u8 } from "../../../core/int.js";

const RELEASE_DELAY = 14;
const DELAY_RELOAD = 128;

export function loc_2b52(m, slot = m.regs.ix) {
  const { mem8 } = m;
  const remaining = u8(mem8[slot + RELEASE_DELAY] - 1);
  mem8[slot + RELEASE_DELAY] = remaining;
  if (remaining !== 0) return;

  mem8[slot] = mem8[slot] + 1;
  mem8[slot + RELEASE_DELAY] = DELAY_RELOAD;
}
