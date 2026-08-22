// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  TERMINATOR_SCAN_SRC,
  TERMINATOR_MATCH_TABLE,
  TAMPER_STRIKES_TERMINATOR,
} from "./names.js";
/**
 * loc_64be — terminator match-scan guard (dissolved caller-skip).
 *
 * Walks a source pointer downward while matching each byte against an ascending
 * expected table, stopping when a fetched table byte reaches the 0x01 sentinel (clean)
 * or a compared byte differs (tampered). A difference bumps TAMPER_STRIKES_TERMINATOR;
 * the sentinel path writes nothing. Both outcomes abort the caller, so this always
 * returns false — the boolean stands in for discarding the caller's return.
 *
 * LIVE-OUT: none. The walking cursors and the compare accumulator do not survive the
 * abort. Memory: TAMPER_STRIKES_TERMINATOR is bumped only on a mismatch.
 */
export function loc_64be(m, src = m.regs.de, table = m.regs.hl) {
  const { mem8 } = m;
  let from = src;
  let want = table;
  for (;;) {
    if (((mem8[from] - mem8[want]) & 0xff) !== 0) {
      mem8[TAMPER_STRIKES_TERMINATOR] = mem8[TAMPER_STRIKES_TERMINATOR] + 1; // mismatch -> strike
      return false;
    }
    from = u16(from - 1);
    want = u16(want + 1);
    if (((mem8[want] - 1) & 0xff) === 0) return false; // sentinel reached -> clean abort
  }
}
