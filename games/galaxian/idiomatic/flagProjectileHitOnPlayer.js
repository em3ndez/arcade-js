// SPDX-License-Identifier: GPL-3.0-only
/**
 * flagProjectileHitOnPlayer — box-test one enemy-shot entry against the player ship.
 *
 * WHAT IT IS
 *   The per-entry half of the enemy-shot-vs-player collision (mechanisms.md "The player is
 *   tested against the two enemy hazards"). Given one entry of the fourteen-slot enemy-shot
 *   table, if the entry is active and its box overlaps the ship it deactivates the entry and
 *   raises the player-death event flag. The sweep caller flagProjectileHitsOnPlayer (0x0b77)
 *   feeds it every entry in turn.
 *
 * ROLE IN THE MACHINE
 *   The ship's X lives in one cell, loc_4202 (0x4202) — the same byte the enemy AI reads as its
 *   aim target — so this test measures each shot's X against loc_4202 and its Y across a near/far
 *   band. On a hit it raises HIT_EVENT_FLAG (0x4204), the player-death event consumed once per
 *   frame by handlePlayerHitEvent (0x12ed). `obj` defaults to the Z80 IX pointer and `e` to
 *   register E; the sweep passes the record stride (5) as `e`, so it doubles as the band width.
 *
 * ROM 0x0b8d.  Grounding: [seen].
 *
 * LIVE-OUT: on an overlap, mem8[obj]=0 (entry deactivated) and HIT_EVENT_FLAG (0x4204)=1.
 */
import { loc_4202, HIT_EVENT_FLAG } from "./names.js";

// Field offsets within the object entry addressed by `obj`.
const ACTIVE_BIT = 1; // low bit of the first byte: set = live entry
const ENTRY_Y = 1;
const ENTRY_X = 3;

export function flagProjectileHitOnPlayer(m, obj = m.regs.ix, e = m.regs.e) {
  const { mem8 } = m;

  // Inactive entries never hit.
  if ((mem8[obj] & ACTIVE_BIT) === 0) return;

  // dxBase = signed 8-bit gap from the shot's X (obj+ENTRY_X) to the ship's X reference loc_4202.
  // yShifted biases the shot's Y (obj+ENTRY_Y) by 31 to line the ship band up at a known offset,
  // wrapping in 8 bits so the near/far comparisons below can be plain unsigned magnitude tests.
  const playerX = mem8[loc_4202];
  const dxBase = (playerX - mem8[obj + ENTRY_X]) & 0xff;
  const yShifted = (mem8[obj + ENTRY_Y] + 31) & 0xff;

  // The Z80 splits the box test into two Y regimes measured against the band width `e`.
  let hit;
  if (yShifted < e) {
    // Far band: X within `e` of the player (plus a 2-unit bias).
    hit = ((dxBase + 2) & 0xff) < e;
  } else {
    // Near band: entry Y must sit within 9 units, then X within 11 (biased by `e`).
    if (((yShifted - e) & 0xff) >= 9) return;
    hit = ((dxBase + e) & 0xff) < 11;
  }
  if (!hit) return;

  // Overlap: retire this enemy shot (clear its active byte) and raise the player-death event.
  // handlePlayerHitEvent (0x12ed) is the sole consumer of HIT_EVENT_FLAG and drains it next frame.
  mem8[obj] = 0; // deactivate the struck entry
  mem8[HIT_EVENT_FLAG] = 1;
}
