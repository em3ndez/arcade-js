// SPDX-License-Identifier: GPL-3.0-only
import { seedSpawnColumnAndRunBody } from "./seedSpawnColumnAndRunBody.js";
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { ACTIVE_LANE_COUNT, ROUND_COUNTER, SCRIPT_FLAG_TABLE, SCRIPT_VALUE_BYTE } from "./names.js";
/**
 * activateLaneActorSlot — one-shot activator for the lane-actor record at IX.
 *
 * Live slot (head word (ix+0,ix+1) non-zero) -> the sweep keeps scanning. Else activate: bump the
 * lane tally, mark the slot, pick kind E (0x1d/0x04 by ROUND_COUNTER bit0), run the spawn body, OR
 * the SCRIPT_FLAG_TABLE[SCRIPT_VALUE_BYTE] lookup into (ix+7).
 *
 * DISSOLVED caller-skip -> boolean: true = already active (keep sweeping), false = activated (abort
 * the caller's sweep). LIVE-OUT: memory + the boolean; no CPU register.
 */
export function activateLaneActorSlot(m, ix = m.regs.ix) {
  const { mem8 } = m;

  if ((mem8[ix + 0x00] | mem8[ix + 0x01]) !== 0) return true; // slot live (ret nz)

  mem8[ACTIVE_LANE_COUNT] = mem8[ACTIVE_LANE_COUNT] + 1;
  mem8[ix + 0x00] = 0x01;
  const kind = (mem8[ROUND_COUNTER] & 0x01) ? 0x1d : 0x04; // E by round parity

  seedSpawnColumnAndRunBody(m, ix, kind); // spawn-one-actor wrapper: seeds C=0xff then runs the spawn body

  const [flag] = fetchByteFromTableIndex(m, SCRIPT_FLAG_TABLE, mem8[SCRIPT_VALUE_BYTE]);
  mem8[ix + 0x07] = flag | mem8[ix + 0x07];

  return false; // activated -> abort the sweep
}
