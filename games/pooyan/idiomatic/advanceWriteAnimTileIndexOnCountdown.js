// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { appendWriteAnimBlockRowOnPhase } from "./appendWriteAnimBlockRowOnPhase.js";
import { floodWriteAnimCellsAndLatchPhase } from "./floodWriteAnimCellsAndLatchPhase.js";
import {
  loc_8e21,
  WRITE_ANIM_TILE_INDEX,
  WRITE_ANIM_STEP_DELAY,
  WRITE_ANIM_WRITE_PTR,
  WRITEANIM_COUNTDOWN,
} from "./names.js";

/**
 * advanceWriteAnimTileIndexOnCountdown — write-anim dispatch entry 1, driven from the animation work-block (no register input).
 *
 * Decrements a 16-bit down-counter; at zero it hands off to the shared tail. Otherwise a flag byte
 * selects the index direction (bit 3 set steps DOWN and wraps at the low bound; bit 3 clear + bit 2
 * set steps UP and wraps at the high bound; bit 3 clear + bit 2 clear tails into the append handler
 * with no step). An index step first ticks a reload sub-timer, returning while it still counts, then
 * stores the stepped index through the destination pointer and falls into the append handler.
 *
 * LIVE-OUT: memory only; the register file is scratch.
 */


const RELOAD_VALUE = 0x0c; //     value the reload sub-timer is re-seeded to on expiry
const INDEX_LO = 0x10; //         low index bound; a DOWN step below it wraps to INDEX_HI
const INDEX_HI = 0x2c; //         high index bound; an UP step above it wraps to INDEX_LO

export function advanceWriteAnimTileIndexOnCountdown(m) {
  const { mem8 } = m;

  // Decrement the 16-bit counter; when it drains to zero, hand off to the shared tail.
  const counter = u16((mem8[WRITEANIM_COUNTDOWN] | (mem8[WRITEANIM_COUNTDOWN + 1] << 8)) - 1);
  mem8[WRITEANIM_COUNTDOWN] = counter;
  mem8[WRITEANIM_COUNTDOWN + 1] = (counter >> 8);
  if (counter === 0) return floodWriteAnimCellsAndLatchPhase(m);

  // The flag byte pointed to by the source pointer selects the index direction.
  const flags = mem8[mem8[loc_8e21] | (mem8[loc_8e21 + 1] << 8)];

  if (flags & 0x08) {
    // bit 3 set: index counts DOWN
    mem8[WRITE_ANIM_STEP_DELAY] = mem8[WRITE_ANIM_STEP_DELAY] - 1;
    if (mem8[WRITE_ANIM_STEP_DELAY] !== 0) return;
    mem8[WRITE_ANIM_STEP_DELAY] = RELOAD_VALUE;
    mem8[WRITE_ANIM_TILE_INDEX] = mem8[WRITE_ANIM_TILE_INDEX] - 1;
    if (mem8[WRITE_ANIM_TILE_INDEX] < INDEX_LO) mem8[WRITE_ANIM_TILE_INDEX] = INDEX_HI; // wrap up past the low bound
  } else if ((flags & 0x04) === 0) {
    // bit 3 clear, bit 2 clear: tail into the append handler (no index step)
    return appendWriteAnimBlockRowOnPhase(m);
  } else {
    // bit 3 clear, bit 2 set: index counts UP
    mem8[WRITE_ANIM_STEP_DELAY] = mem8[WRITE_ANIM_STEP_DELAY] - 1;
    if (mem8[WRITE_ANIM_STEP_DELAY] !== 0) return;
    mem8[WRITE_ANIM_STEP_DELAY] = RELOAD_VALUE;
    mem8[WRITE_ANIM_TILE_INDEX] = mem8[WRITE_ANIM_TILE_INDEX] + 1;
    if (mem8[WRITE_ANIM_TILE_INDEX] > INDEX_HI) mem8[WRITE_ANIM_TILE_INDEX] = INDEX_LO; // wrap down past the high bound
  }

  // Store the stepped index byte through the destination pointer, then fall into the append handler.
  const dest = mem8[WRITE_ANIM_WRITE_PTR] | (mem8[WRITE_ANIM_WRITE_PTR + 1] << 8);
  mem8[dest] = mem8[WRITE_ANIM_TILE_INDEX];
  return appendWriteAnimBlockRowOnPhase(m);
}
