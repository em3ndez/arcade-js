// SPDX-License-Identifier: GPL-3.0-only
import { ENEMY_ACTOR_TABLE } from "./names.js";
import { loc_2c3f } from "./loc_2c3f.js";

/**
 * loc_2c2c — sweep the 17 hunter records through the per-record state dispatcher.
 *
 * Walks the record table (stride 0x18) and hands each record to the per-record dispatcher,
 * marshalling the record pointer through IX. The dispatcher returns false once a record reaches its
 * spawn handler, which aborts the sweep — a dissolved caller-skip reported as a boolean.
 *
 * LIVE-OUT: memory only — the caller rets immediately, reading no register back.
 */

const RECORD_STRIDE = 0x18;
const HUNTER_RECORD_COUNT = 0x11;

export function loc_2c2c(m) {
  let rec = ENEMY_ACTOR_TABLE;
  for (let i = 0; i < HUNTER_RECORD_COUNT; i++) {
    m.regs.ix = rec; // dispatcher reads the record pointer from IX (register bridge)
    if (!loc_2c3f(m)) return; // per-record dispatcher; false aborts the sweep
    rec += RECORD_STRIDE;
  }
}
