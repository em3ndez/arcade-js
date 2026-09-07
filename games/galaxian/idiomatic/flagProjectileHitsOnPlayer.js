// SPDX-License-Identifier: GPL-3.0-only
/**
 * flagProjectileHitsOnPlayer — sweep all enemy shots against the player ship.
 *
 * WHAT IT IS
 *   The enemy-shot-vs-player collision sweep (mechanisms.md "The player is tested against the two
 *   enemy hazards"). It loops the fourteen-entry enemy-shot table and hands each entry to the
 *   per-entry box test flagProjectileHitOnPlayer (0x0b8d), which deactivates any shot that
 *   overlaps the ship and raises the player-death event.
 *
 * ROLE IN THE MACHINE
 *   Runs each frame in the play pipeline and is gated on OBJ_ACTIVE_FLAG (0x4200) bit0 — the
 *   master switch for the whole object/AI/projectile subsystem. With it clear (attract, or the
 *   freeze that handlePlayerHitEvent applies on a death) no enemy shots exist, so the sweep is a
 *   no-op. The shot table lives at loc_4260 (0x4260) with a 5-byte stride per entry.
 *
 * ROM 0x0b77.  Grounding: [seen].
 *
 * LIVE-OUT: none directly; per overlapped entry the callee clears the entry and sets
 * HIT_EVENT_FLAG (0x4204)=1 for handlePlayerHitEvent (0x12ed) to consume.
 */
import { flagProjectileHitOnPlayer } from "./flagProjectileHitOnPlayer.js";
import { OBJ_ACTIVE_FLAG, loc_4260 } from "./names.js";

const ENTRY_COUNT = 14;
const ENTRY_STRIDE = 5;
// The per-entry check reads its Y-band delta from register E, which the loop leaves holding the
// low byte of the record stride (5). So the band delta is always the stride value 5 -- never
// whatever E the caller happened to hold on entry.
const BAND_DELTA = ENTRY_STRIDE;

export function flagProjectileHitsOnPlayer(m) {
  const { mem8 } = m;

  // Subsystem gate: OBJ_ACTIVE_FLAG (0x4200) bit0 clear means the object/projectile subsystem is
  // off (attract, or the post-death freeze), so there are no live shots to test.
  // Projectiles disabled: nothing to test.
  if ((mem8[OBJ_ACTIVE_FLAG] & 1) === 0) return;

  // Test each of the 14 shot entries: base loc_4260 (0x4260), ENTRY_STRIDE (5) bytes apart. The
  // per-entry test gets BAND_DELTA (=5) as its Y-band width, matching the Z80 leaving E at the
  // stride's low byte across the loop rather than at whatever the caller held on entry.
  for (let i = 0; i < ENTRY_COUNT; i++) {
    flagProjectileHitOnPlayer(m, loc_4260 + i * ENTRY_STRIDE, BAND_DELTA);
  }
}
