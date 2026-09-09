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
 * spawnActorOnTimer — the gated periodic actor factory. Once per frame it ticks its own countdown
 * and, on expiry, drops a fresh actor into a free slot.
 *
 * Role in the machine: this is the interval-driven spawner leg of the timing subsystem (alongside
 * `serviceTimerBank` and `tickSpawnCadence`). Two flags gate it: the enable byte $97 must be set and
 * the busy byte $87 must be clear. Its own countdown $a0 (SPAWN_TIMER) spaces the spawns, and each
 * spawn ratchets the reload down so spawns come faster and faster until the reload floors out — a
 * self-accelerating difficulty ramp.
 *
 * Cells: $97 enable, $87 busy, $a0 the spawn countdown, $88 the per-index "channel" selector; the
 * 12-slot actor array based at $34 with its parallel field arrays $64/$54/$74/$44; $a1+x the
 * per-channel reload value; $94+x the per-channel spawn tally; $f0 the orientation/flip byte; the
 * POKEY RANDOM hardware RNG at $100a picks the actor variant.
 *
 * Grounding: [code]; $a0 and $100a are [seen]. Live-out: one actor slot and its fields ($34+y,
 * $64+y, $54+y, $74+y, $44+y), the countdown $a0, the per-channel reload $a1+x, and the tally $94+x.
 */
export function spawnActorOnTimer(m) {
  const { mem8 } = m;

  // Two enable gates. Nothing happens unless the spawner is enabled ($97 set) and not currently
  // busy ($87 clear) — a busy field naturally suspends spawning for the frame.
  if (mem8[loc_97] === 0) return; // spawner disabled
  if (mem8[loc_87] !== 0) return; // busy -> skip this frame

  // Interval spacing: while the countdown $a0 is still running, just tick it down and leave, so
  // nothing spawns mid-interval. Only the frame $a0 reaches zero runs the spawn body below.
  if (mem8[SPAWN_TIMER] !== 0) {
    mem8[SPAWN_TIMER] = u8(mem8[SPAWN_TIMER] - 1); // countdown still running: tick and leave
    return;
  }

  // Pick the per-index "channel" (which spawn stream this expiry belongs to), then hunt for a home.
  const x = mem8[loc_88]; // per-index selector (which spawn "channel")

  // Scan the 12 actor slots ($34+s) from high index down to low for the first free one. A slot is
  // free when its byte has the high (sign) bit set; the negative sentinel marks an empty slot.
  let y = -1;
  for (let s = 0x0b; s >= 0; s--) {
    if (mem8[u16(loc_34 + s)] & 0x80) { y = s; break; } // first free (negative) slot, high -> low
  }
  // If every slot is occupied, nothing spawns and the countdown is deliberately NOT reloaded — a
  // full field throttles spawning until a slot frees up.
  if (y < 0) return; // no free slot: nothing spawns this expiry

  // Claim slot y and seed the new actor's fields. The byte is zeroed to mark it alive; the vertical
  // field takes an orientation-folded value (0x40 ^ $f0) so it mirrors for a flipped cabinet; and
  // two fixed motion seeds are laid down (the $54 seed may be overridden by the variant coin-flip).
  mem8[u16(loc_34 + y)] = 0x00; // claim the slot (alive/type)
  mem8[u16(loc_64 + y)] = 0x40 ^ mem8[loc_f0]; // orientation-folded field
  mem8[u16(loc_54 + y)] = 0xfc; // motion seed (may be overridden below)
  mem8[u16(loc_74 + y)] = 0x02; // motion seed

  // Reload the countdown from this channel's value at $a1+x — but as a ratchet, not a constant.
  // While the stored reload is 0x60 or greater, cut it by 0x08 and write it back, so each spawn on
  // this channel shortens the next interval; once it floors out below 0x60 it stops shrinking.
  let reload = mem8[u8(loc_a1 + x)]; // per-index timer reload value
  if (reload >= 0x60) {
    reload = u8(reload - 0x08); // ratchet the reload down by 8 while it stays >= 0x60...
    mem8[u8(loc_a1 + x)] = reload; // ...and write it back so spawns speed up over time
  }
  mem8[SPAWN_TIMER] = reload; // reset the countdown

  // A coin-flip from the POKEY hardware RNG (bit 1) picks the new actor's variant: variant A sets
  // $44+y to 0x02; variant B instead overrides the $54 motion seed with 0x04 and uses the mirrored
  // value 0xFE in $44+y. This is what gives spawned actors two different launch behaviours.
  if (mem8[POKEY_RANDOM] & 0x02) {
    mem8[u16(loc_44 + y)] = 0x02; // random variant A
  } else {
    mem8[u16(loc_54 + y)] = 0x04; // random variant B: override the motion seed...
    mem8[u16(loc_44 + y)] = 0xfe; // ...and use the mirrored $44 value
  }

  // Record the spawn against this channel's running tally.
  mem8[u8(loc_94 + x)] = u8(mem8[u8(loc_94 + x)] + 1); // bump the per-index spawn counter
}
