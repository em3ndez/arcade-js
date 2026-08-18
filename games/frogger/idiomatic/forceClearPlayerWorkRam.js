// SPDX-License-Identifier: GPL-3.0-only
/**
 * forceClearPlayerWorkRam — unconditional force-clear of the current player's work RAM: zeroes the
 * frog object block and the home-bay gate block via two block-copies, with no guard. LIVE-OUT is
 * memory-only. The frozen tail's return is omitted here — a direct caller leaves the stack untouched,
 * and a dispatched caller gets the return supplied by the omitted-return wiring.
 */
import { FROG_X, HOME_BAY_GATE_BLOCK } from "./names.js";
import { u16 } from "../../../core/int.js";

const FROG_BLOCK_LEN = 0x20;
const GATE_BLOCK_LEN = 0x0c;

export function forceClearPlayerWorkRam(m) {
  const { mem8 } = m;
  for (let i = 0; i < FROG_BLOCK_LEN; i++) mem8[u16(FROG_X + i)] = 0;
  for (let i = 0; i < GATE_BLOCK_LEN; i++) mem8[u16(HOME_BAY_GATE_BLOCK + i)] = 0;
}
