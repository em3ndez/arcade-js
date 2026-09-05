// SPDX-License-Identifier: GPL-3.0-only
// Gated prescaler sweep over a block of sub-counters. Runs only while the play flag
// is set and both inhibit flags are clear. Ticks a master counter; until it expires
// the refill flag is cleared. On expiry it reloads the master and decrements a span
// of sub-counters (span from the pace counter and stage), refilling each that reaches
// zero from the matching reload-table entry, and raises the refill flag if any refilled.
import {
  OBJ_ACTIVE_FLAG,
  loc_4220,
  loc_422b,
  loc_421a,
  loc_421b,
  loc_424a,
  SUBCOUNTER_REFILL_FLAG,
  SUBCOUNTER_RELOAD_TABLE,
} from "./names.js";
import { reloadExpiredCounterAndTally } from "./reloadExpiredCounterAndTally.js";

export function loc_1515(m) {
  const { mem8 } = m;

  // Gate: play flag on, both inhibit flags off.
  if ((mem8[OBJ_ACTIVE_FLAG] & 0x01) === 0) return;
  if (mem8[loc_4220] & 0x01) return;
  if (mem8[loc_422b] & 0x01) return;

  // Span of sub-counters to sweep, from the pace counter and the (clamped) stage.
  const pace = mem8[loc_421a];
  const stage = mem8[loc_421b];
  const span = ((pace + (stage >= 2 ? stage : 0)) & 0x0f) + 1;

  // Tick the master counter; until it expires, drop the refill flag and stop.
  const master = (mem8[loc_424a] - 1) & 0xff;
  mem8[loc_424a] = master;
  if (master !== 0) {
    mem8[SUBCOUNTER_REFILL_FLAG] = 0;
    return;
  }

  // Expired: reload the master, then sweep the sub-counters, refilling each expired
  // one from its reload-table entry and tallying the refills.
  mem8[loc_424a] = mem8[SUBCOUNTER_RELOAD_TABLE];
  let refills = 0;
  for (let i = 1; i <= span; i++) {
    const cell = loc_424a + i;
    const remaining = (mem8[cell] - 1) & 0xff;
    mem8[cell] = remaining;
    if (remaining === 0) {
      refills = reloadExpiredCounterAndTally(m, SUBCOUNTER_RELOAD_TABLE + i, cell, refills);
    }
  }

  // Raise the refill flag only if something was refilled.
  if (refills !== 0) mem8[SUBCOUNTER_REFILL_FLAG] = 1;
}
