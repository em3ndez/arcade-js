// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  loc_87,
  loc_88,
  loc_97,
  SPAWN_TIMER,
  loc_a1,
  loc_34,
  loc_44,
  loc_54,
  loc_64,
  loc_74,
  loc_94,
  POKEY_RANDOM,
  loc_f0,
} from "./names.js";

/**
 * spawnActorOnTimer — gated periodic spawner: tick a countdown and, on expiry,
 * drop a fresh actor into a free slot. Gated by two flags — does nothing unless the
 * enable byte $97 is set and the busy byte $87 is clear. When enabled it decrements
 * the countdown $a0 and returns while it is still running. On the frame $a0 reaches
 * 0 it scans the 12 actor slots ($34+Y) for a free one (negative byte = free); if
 * found it seeds that slot's fields, reloads $a0 from a per-index value ($a1,X)
 * ratcheted down by 8 (until it drops below 0x60) so spawns come faster, and bumps
 * a per-index spawn counter ($94,X). A random bit picks the $44 variant.  [code]
 */
export function spawnActorOnTimer(m) {
  const { mem8 } = m;
  if (mem8[loc_97] === 0) return; // spawner disabled
  if (mem8[loc_87] !== 0) return; // busy -> skip this frame
  if (mem8[SPAWN_TIMER] !== 0) {
    mem8[SPAWN_TIMER] = u8(mem8[SPAWN_TIMER] - 1); // countdown still running: tick and leave
    return;
  }
  const x = mem8[loc_88]; // per-index selector (which spawn "channel")
  let y = -1;
  for (let s = 0x0b; s >= 0; s--) {
    if (mem8[u16(loc_34 + s)] & 0x80) { y = s; break; } // first free (negative) slot, high -> low
  }
  if (y < 0) return; // no free slot: nothing spawns this expiry
  mem8[u16(loc_34 + y)] = 0x00; // claim the slot (alive/type)
  mem8[u16(loc_64 + y)] = 0x40 ^ mem8[loc_f0]; // orientation-folded field
  mem8[u16(loc_54 + y)] = 0xfc; // motion seed (may be overridden below)
  mem8[u16(loc_74 + y)] = 0x02; // motion seed
  let reload = mem8[u8(loc_a1 + x)]; // per-index timer reload value
  if (reload >= 0x60) {
    reload = u8(reload - 0x08); // ratchet the reload down by 8 while it stays >= 0x60...
    mem8[u8(loc_a1 + x)] = reload; // ...and write it back so spawns speed up over time
  }
  mem8[SPAWN_TIMER] = reload; // reset the countdown
  if (mem8[POKEY_RANDOM] & 0x02) {
    mem8[u16(loc_44 + y)] = 0x02; // random variant A
  } else {
    mem8[u16(loc_54 + y)] = 0x04; // random variant B: override the motion seed...
    mem8[u16(loc_44 + y)] = 0xfe; // ...and use the mirrored $44 value
  }
  mem8[u8(loc_94 + x)] = u8(mem8[u8(loc_94 + x)] + 1); // bump the per-index spawn counter
}
