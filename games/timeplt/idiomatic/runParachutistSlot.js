// SPDX-License-Identifier: GPL-3.0-only
/** runParachutistSlot — run the single parachutist slot for one frame, doing nothing in the era that has
 * none. The slot's own state byte picks the step: a free slot goes to the spawner; a slot in
 * flight drifts along its velocity and is retired the moment it lands on a retire line, else its
 * sprite takes the next shape the frame tick selects; any value between drifts with the world and
 * then either posts its bonus, shows its award, or counts down and retires at zero. LIVE-OUT: memory. */

import { ERA_INDEX, FRAME_TICK } from "./names.js";
import { fetchTableByte } from "./fetchTableByte.js";
import { driftWithWorldScroll } from "./driftWithWorldScroll.js";
import { flyAlongStoredVelocity } from "./flyAlongStoredVelocity.js";
import { hasReachedRetireLine } from "./hasReachedRetireLine.js";
import { spawnAtEdgeAhead } from "./spawnAtEdgeAhead.js";
import { postNextParachutistBonus } from "./postNextParachutistBonus.js";
import { showParachutistAward } from "./showParachutistAward.js";
import { retireSlotIntoCooldown } from "./retireSlotIntoCooldown.js";

const PARACHUTIST_RECORD = 0xa8f0;
const PARACHUTIST_SPRITE = 0xaa2e;
const ERA_WITH_NO_PARACHUTISTS = 4;

const FREE_SLOT = 0x00;
const IN_FLIGHT = 0xff;
const POST_BONUS_STATE = 0x10;
const SHOW_AWARD_FROM = 0x3c;

const SHAPE_TABLE = 0x47ea;
const SHAPE_OFFSET = 0x01;
const CONTROL_OFFSET = 0x30;
const CONTROL_BYTE = 0x75;

export function runParachutistSlot(m) {
  const { regs, mem8 } = m;
  if (mem8[ERA_INDEX] === ERA_WITH_NO_PARACHUTISTS) return;

  regs.ix = PARACHUTIST_RECORD;
  regs.iy = PARACHUTIST_SPRITE;
  const state = mem8[PARACHUTIST_RECORD];
  if (state === FREE_SLOT) return spawnAtEdgeAhead(m);

  if (state !== IN_FLIGHT) {
    driftWithWorldScroll(m);
    if (state === POST_BONUS_STATE) return postNextParachutistBonus(m);
    if (state >= SHOW_AWARD_FROM) return showParachutistAward(m);
    mem8[PARACHUTIST_RECORD] = state - 1;
    if (mem8[PARACHUTIST_RECORD] !== 0) return;
    return retireSlotIntoCooldown(m);
  }

  flyAlongStoredVelocity(m);
  if (hasReachedRetireLine(m)) return retireSlotIntoCooldown(m);
  regs.hl = SHAPE_TABLE;
  regs.a = (mem8[FRAME_TICK] >> 4) & 7;
  mem8[PARACHUTIST_SPRITE + SHAPE_OFFSET] = fetchTableByte(m);
  mem8[PARACHUTIST_SPRITE + CONTROL_OFFSET] = CONTROL_BYTE;
}
