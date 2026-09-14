// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { PLAYER_SEGMENT, PLAYER_SHOT_DEPTH, ENEMY_SEGMENT, ENEMY_DEPTH } from "./names.js";
import { insertObjectHeadTag9 } from "./insertObjectHeadTag9.js";

/**
 * fireHitOnPlayerCollision — fire the hit routine when enemy slot x sits on top of the player. ROM 0x9e48.
 *
 * Role in the machine: Tempest positions everything on the tube by two coordinates — a segment (which
 * lane around the rim) and a depth (how far down the tube). A hostile object occupying the player's
 * exact square is a collision. This routine is the per-slot collision gate: it checks slot x against the
 * player and, on an exact match, triggers the hit that spawns the kill/explosion object.
 *
 * Behavior: it compares the two axes in turn. First depth — the slot's depth loc_2df,x (ENEMY_DEPTH)
 * against the player's depth loc_202 (PLAYER_SHOT_DEPTH); a mismatch returns immediately. Then segment —
 * the slot's segment loc_2b9,x (ENEMY_SEGMENT) against the player's segment loc_200 (PLAYER_SEGMENT);
 * again any mismatch returns with no effect. Only when both axes coincide does it call insertObjectHeadTag9
 * to emit the hit, threading seedY (the dispatch index carried in Y) through explicitly.
 *
 * Live-out: on a match, whatever insertObjectHeadTag9 queues (the tag-9 hit object); otherwise nothing.
 * Grounding: [seen].
 */
// Collision test: fire the hit routine only when a slot's coordinates match the
// player's on both axes; any mismatch returns without effect.
export function fireHitOnPlayerCollision(m, x = m.regs.x, seedY = m.regs.y) {
  const { mem8 } = m;
  if (mem8[u16(ENEMY_DEPTH + x)] !== mem8[PLAYER_SHOT_DEPTH]) return;  // axis-one mismatch
  if (mem8[u16(ENEMY_SEGMENT + x)] !== mem8[PLAYER_SEGMENT]) return;  // axis-two mismatch
  insertObjectHeadTag9(m, x, seedY); // seedY (the dispatch index) is the seed's Y, threaded explicitly
}
