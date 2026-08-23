// SPDX-License-Identifier: GPL-3.0-only
import { loc_6069 } from "./loc_6069.js";
import {
  ENEMY_TARGET_REC0,
  ENEMY_TARGET_REC1,
  ACTIVE_OBJECT_TYPE,
  SPRITE_OBJECT_TABLE,
  SPRITE_SCAN_ACTOR_SLOTS,
} from "./names.js";
/**
 * loc_6048 — arm and enter the object-record proximity scan for one slot.
 *
 * Picks the slot's presence block by the slot selector, then gates on that block's lead byte: an
 * empty (0) or already-engaged (3) block is inert and returns normally. A live block latches its
 * kind as the active hit type and enters the scan over the object table.
 *
 * LIVE-OUT: a boolean forwarded from the scan — true = normal completion, false = a caller-skip
 * must unwind the caller's frame. The two inert kinds return true.
 */
const INERT_EMPTY = 0x00;
const INERT_ENGAGED = 0x03;
const SCAN_COUNT = 0x05;

export function loc_6048(m, slot = m.regs.i) {
  const { mem8 } = m;
  const kind = mem8[slot === 0 ? ENEMY_TARGET_REC0 : ENEMY_TARGET_REC1];
  if (kind === INERT_EMPTY || kind === INERT_ENGAGED) return true;
  mem8[ACTIVE_OBJECT_TYPE] = kind;
  return loc_6069(m, SPRITE_OBJECT_TABLE, SPRITE_SCAN_ACTOR_SLOTS, SCAN_COUNT);
}
