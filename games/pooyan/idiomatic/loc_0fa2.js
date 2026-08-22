// SPDX-License-Identifier: GPL-3.0-only
import { loc_0fc3 } from "./loc_0fc3.js";
import { ROUND_COUNTER } from "./names.js";
/**
 * loc_0fa2 — emit the round-select tile run.
 *
 * Folds two bits of the round counter (those just above bit0) into a 0..3 selector, biases
 * it onto one of four consecutive tile codes, and appends that code plus the fixed run bytes
 * to the command ring through the shared run-append helper.
 *
 * LIVE-OUT: A = the advanced ring cursor from the append tail (0 when the gates are shut);
 * the append leaves it in A and the caller reads it, and the tail return carries it through.
 */

const TILE_CODE_BASE = 0x22;
const SELECTOR_MASK = 0x03;

export function loc_0fa2(m) {
  const { mem8 } = m;
  const selector = (mem8[ROUND_COUNTER] >> 1) & SELECTOR_MASK;
  return loc_0fc3(m, TILE_CODE_BASE + selector);
}
