// SPDX-License-Identifier: GPL-3.0-only
import { loc_6e86 } from "./loc_6e86.js";
import { loc_6edb } from "./loc_6edb.js";
import { TAMPER_FREEZE_FLAG, SIGNATURE_MISMATCH_FLAG } from "./names.js";
/**
 * loc_6e75 — phase-1 spawner gate. With neither guard flag set, runs the
 * single-object launcher then the per-record driver. A set flag would take a
 * skip-spawn jump into data (a dead trap), so model it as unreachable.
 *
 * LIVE-OUT: memory only — the caller returns straight after and reads no register back.
 */
export function loc_6e75(m) {
  const { mem8 } = m;

  if (mem8[SIGNATURE_MISMATCH_FLAG] | mem8[TAMPER_FREEZE_FLAG]) {
    throw new Error("loc_6e75: skip-spawn arm unreachable with a valid ROM (target is data)");
  }

  loc_6e86(m);
  loc_6edb(m);
}
