// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { activateLaneActorSlot } from "./activateLaneActorSlot.js";
import {
  SLOT_SWEEP_LATCH,
  SCRIPT_DATA_PTR,
  SCRIPT_DELAY_TIMER,
  SCRIPT_ADVANCE_GUARD,
  STAGE_COUNTDOWN,
  ENEMY_SPAWN_TIMER,
  ENEMY_ACTOR_TABLE,
} from "./names.js";
/**
 * spawnNextScriptedEnemy — lane-sweep script tick, gated on SLOT_SWEEP_LATCH.
 *
 * Reads the live script byte at SCRIPT_DATA_PTR. When it is not 0xff it is a delay count: tick
 * SCRIPT_DELAY_TIMER and, on expiry, reseed it from that byte, advance the pointer, then sweep the
 * 6 stride-0x18 records at ENEMY_ACTOR_TABLE activating each (a slot activation aborts
 * the sweep). When the script byte is 0xff, once STAGE_COUNTDOWN drops below SCRIPT_ADVANCE_GUARD
 * the guard/latch/spawn-timer are cleared. LIVE-OUT: memory only (dispatched handler).
 */
const RECORD_STRIDE = 0x18;
const SWEEP_COUNT = 0x06;
const TERMINATOR = 0xff;

export function spawnNextScriptedEnemy(m) {
  const { mem8 } = m;

  if (mem8[SLOT_SWEEP_LATCH] === 0) return; // not latched (ret z)

  const ptr = mem8[SCRIPT_DATA_PTR] | (mem8[SCRIPT_DATA_PTR + 1] << 8); // 16-bit script pointer
  const scriptByte = mem8[ptr];

  if (scriptByte !== TERMINATOR) {
    mem8[SCRIPT_DELAY_TIMER] = mem8[SCRIPT_DELAY_TIMER] - 1; // tick the delay (store truncates)
    if (mem8[SCRIPT_DELAY_TIMER] !== 0) return; // delay still running (ret nz)

    mem8[SCRIPT_DELAY_TIMER] = scriptByte; // reseed the delay from the script byte
    const next = u16(ptr + 1);
    mem8[SCRIPT_DATA_PTR] = next; // advance the pointer (low; store truncates)
    mem8[SCRIPT_DATA_PTR + 1] = next >> 8; //                     (high)

    let rec = ENEMY_ACTOR_TABLE;
    for (let n = SWEEP_COUNT; n > 0; n--) {
      if (!activateLaneActorSlot(m, rec)) return; // activation -> abort the sweep (skip-return)
      rec = u16(rec + RECORD_STRIDE);
    }
    return;
  }

  // script byte == 0xff: threshold gate
  if (mem8[STAGE_COUNTDOWN] >= mem8[SCRIPT_ADVANCE_GUARD]) return; // threshold not passed (ret nc)
  mem8[SCRIPT_ADVANCE_GUARD] = 0;
  mem8[SLOT_SWEEP_LATCH] = 0;
  mem8[ENEMY_SPAWN_TIMER] = 0;
}
