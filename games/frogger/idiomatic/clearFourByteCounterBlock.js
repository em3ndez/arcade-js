// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearFourByteCounterBlock — clear the 4-byte timer/counter block to zero.
 * LIVE-OUT: memory-only.
 */
import { FOUR_BYTE_COUNTER_BASE } from "./names.js";

const BLOCK_LEN = 4;

export function clearFourByteCounterBlock(m) {
  const { mem8 } = m;
  for (let i = 0; i < BLOCK_LEN; i++) mem8[(FOUR_BYTE_COUNTER_BASE + i) & 0xffff] = 0;
}
