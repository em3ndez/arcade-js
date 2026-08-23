// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { loc_0c45 } from "./loc_0c45.js";
import { storeActorAnimationPointer } from "./storeActorAnimationPointer.js";
import { setActorAnimation } from "./setActorAnimation.js";
import {
  ROUND_COUNTER,
  SPAWN_ANIM_WORD_TABLE,
  SPAWN_ANIM_SEQ,
  SPAWN_SWEEP_TRIGGER,
} from "./names.js";
/**
 * initDescendingObjectSlot — object-slot initializer (slot = the record scanned by the spawn loop, source = the
 * parent record supplying the position block).
 *
 * DISSOLVED CALLER-SKIP for the spawn loop's caller. If the slot is already live (bit0 of its first two
 * bytes) it returns TRUE — a normal return, the loop continues. Otherwise it seeds the slot: mark it
 * active, copy the 4-byte position block source+3 -> slot+3, seed the anim/state fields, resolve the
 * spawn animation from the round-indexed table, and return FALSE — the caller-skip that aborts the
 * loop (the caller discards its own return with `pop af; ret`). LIVE-OUT: memory + the boolean.
 */
const LIVE_BIT = 0x01; // bit0 of (slot+0)|(slot+1): the slot is occupied

export function initDescendingObjectSlot(m, slot = m.regs.iy, source = m.regs.ix) {
  const { mem8 } = m;

  if (((mem8[slot] | mem8[slot + 1]) & LIVE_BIT) !== 0) return true; // slot busy -> normal return

  mem8[slot] = 0x01; // mark the slot active
  mem8[slot + 2] = 0x0d; // seed the state byte

  let src = (source & ~0xff) | ((source + 3) & 0xff); // source+3 (low-byte inc, page-local)
  let dst = (slot & ~0xff) | ((slot + 3) & 0xff); // slot+3
  for (let i = 0; i < 4; i++) {
    mem8[dst] = mem8[src]; // copy the 4-byte position block
    src = u16(src + 1);
    dst = u16(dst + 1);
  }

  mem8[slot + 0x09] = 0x2a;
  mem8[slot + 0x0a] = 0xd6; // -0x2a (negated)

  const idx = ((mem8[ROUND_COUNTER] >> 1) - 1) & 0x03; // round-derived table index
  const animPtr = loc_0c45(m, idx, SPAWN_ANIM_WORD_TABLE); // word from the anim table
  storeActorAnimationPointer(m, slot, animPtr); // install into the slot record

  mem8[SPAWN_SWEEP_TRIGGER] = 0x00;
  setActorAnimation(m, source, SPAWN_ANIM_SEQ); // seat the fixed anim sequence in the source record

  mem8[source + 0x11] = 0x30;
  mem8[slot + 0x11] = 0x04;
  mem8[source + 2] = mem8[source + 2] + 1; // bump the source's state byte (mem8 write truncates)

  return false; // slot initialized -> caller-skip (abort the spawn loop)
}
