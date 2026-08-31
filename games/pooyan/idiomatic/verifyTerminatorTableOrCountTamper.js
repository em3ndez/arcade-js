// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import {
  TERMINATOR_SCAN_SRC,
  TERMINATOR_MATCH_TABLE,
  TAMPER_STRIKES_TERMINATOR,
} from "./names.js";
/**
 * verifyTerminatorTableOrCountTamper — anti-tamper "terminator match-scan" guard, ROM 0x64be-0x64cf. [code]
 *
 * One of Pooyan's several self-integrity checks. The program stores a short table of
 * bytes it EXPECTS to find at a particular place in its own ROM, and this routine
 * confirms the ROM still reads back that way. If a bootleg or a bad chip has altered
 * the region, the bytes no longer match and the game quietly records a strike; enough
 * strikes elsewhere steer the machine into a board/reset path instead of normal play.
 *
 * It compares two runs of bytes that travel in OPPOSITE directions:
 *   - a SOURCE cursor that walks DOWNWARD through the ROM region under test
 *     (the caller hands in its start; TERMINATOR_SCAN_SRC = 0x0bc2 is the usual one), and
 *   - an EXPECTED cursor that walks UPWARD through TERMINATOR_MATCH_TABLE (0x64d0), the
 *     stored list of bytes each source byte must equal.
 * The scan ends one of two ways. On the first byte that DIFFERS it counts a tamper strike
 * by bumping TAMPER_STRIKES_TERMINATOR (0x8df9). Otherwise it keeps going until a freshly
 * fetched EXPECTED byte equals 0x01 — the table's sentinel, which marks "end of list, all
 * clear" — and stops writing nothing. With an intact ROM every compare matches and the
 * sentinel is always reached, so this counter stays 0 in normal play (hence the [code]
 * tag on the strike cell: it is understood from the code, never seen firing).
 *
 * The routine's boolean result is always false. In the original both exits abort the
 * IMMEDIATE caller and return one level further up; the false value carries that
 * "the caller does not continue" outcome across.
 *
 * LIVE-OUT: none via the result (always false) or via the cursors and compare — none of
 * those survive. The only lasting effect is in memory: TAMPER_STRIKES_TERMINATOR is
 * incremented, and ONLY on a mismatch; the clean sentinel path leaves memory untouched.
 */
export function verifyTerminatorTableOrCountTamper(m, src = m.regs.de, table = m.regs.hl) {
  const { mem8 } = m;

  // `from` walks the ROM region under test downward; `want` walks the expected-byte
  // table (TERMINATOR_MATCH_TABLE, 0x64d0) upward. The caller supplies both starts.
  let from = src;
  let want = table;
  for (;;) {
    // Compare this source byte against the byte the table says it must be. Any difference
    // is tamper: count a strike in TAMPER_STRIKES_TERMINATOR (0x8df9) and stop the scan.
    if (((mem8[from] - mem8[want]) & 0xff) !== 0) {
      mem8[TAMPER_STRIKES_TERMINATOR] = mem8[TAMPER_STRIKES_TERMINATOR] + 1; // mismatch -> strike
      return false;
    }
    // Matched: step the two cursors in their opposite directions for the next compare.
    from = u16(from - 1);
    want = u16(want + 1);
    // The freshly advanced table byte doubles as the loop's terminator: when it reads back
    // as 0x01 the list is exhausted and every byte so far matched — a clean, silent abort.
    if (((mem8[want] - 1) & 0xff) === 0) return false; // sentinel reached -> clean abort
  }
}
