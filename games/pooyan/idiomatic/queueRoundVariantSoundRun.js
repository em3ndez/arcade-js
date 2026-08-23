// SPDX-License-Identifier: GPL-3.0-only
import { appendSoundCommandRun } from "./appendSoundCommandRun.js";
import { ROUND_COUNTER } from "./names.js";
/**
 * queueRoundVariantSoundRun — emit the round-select tile run.
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

export function queueRoundVariantSoundRun(m) {
  const { mem8 } = m;
  const selector = (mem8[ROUND_COUNTER] >> 1) & SELECTOR_MASK;
  return appendSoundCommandRun(m, TILE_CODE_BASE + selector);
}
