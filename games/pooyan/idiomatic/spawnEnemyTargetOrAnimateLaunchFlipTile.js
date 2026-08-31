// SPDX-License-Identifier: GPL-3.0-only
import { queueSoundCommand0A } from "./queueSoundCommand0A.js";
import { blit2x2TileBlock } from "./blit2x2TileBlock.js";
import {
  ARROW_Y,
  LAUNCH_FLIP_COUNTDOWN,
  SHARED_PHASE_COUNTDOWN,
  LAUNCH_TILE_VRAM,
  LAUNCH_TILE_SRC,
  LAUNCH_TILE_SRC_ALT,
  ENEMY_TARGET_REC0,
  ENEMY_TARGET_REC1,
  LAUNCH_STATE,
  PLAY_MODE_LATCH,
  LAUNCH_ARMED_FLAG,
  LAUNCH_HUD_TILE,
  loc_8a99,
  loc_8a86,
  loc_8a9e,
  loc_8aa7,
} from "./names.js";
/**
 * spawnEnemyTargetOrAnimateLaunchFlipTile — launch-state-machine state 1.
 *
 * WHAT IT IS
 *   The state-1 handler of the arrow/launch state machine. That machine drives the single
 *   "arrow" object which rises up the playfield and, once it has risen far enough, spawns the
 *   "hunter" attackers that dive at the player. The five-way machine dispatches by the low bits
 *   of LAUNCH_STATE (0x8f30); this body is what runs while that selector holds 1.
 *
 * ITS ROLE IN THE MACHINE
 *   State 1 has two jobs, and it picks between them by the arrow's on-screen height. The arrow's
 *   vertical position lives in ARROW_Y (0x8ab4) — the Y field of the arrow/launch actor record,
 *   which counts DOWN as the arrow climbs the screen. While the arrow is still at or above its
 *   gate height (ARROW_Y >= 0x34) it is mid-flight, so this handler just animates it: a small
 *   frame countdown flips the arrow tile back and forth to make it flap. Once the arrow drops
 *   below the gate (ARROW_Y < 0x34) the flight is over and it is time to convert the arrow into a
 *   hunter: the handler claims a free entry in the two-slot enemy-target record pair, advances the
 *   machine to state 2 (spawnHunterIntoTableAndAdvanceLaunch, which seats the actual hunter),
 *   plays a sound, repaints the tile, may light a HUD cell, and seeds the new record's fields.
 *
 *   ROM 0x27f3-0x2855. Grounding tag: [seen].
 *
 * LIVE-OUT (memory only — a per-frame state handler; nothing reads a value back from it)
 *   Animate branch: decrements LAUNCH_FLIP_COUNTDOWN (0x892f), and on each expiry reloads it to
 *     0x10, bumps SHARED_PHASE_COUNTDOWN (0x892e), and repaints the 2x2 arrow at LAUNCH_TILE_VRAM
 *     (0x84a7) with one of two tile sources chosen by that byte's parity.
 *   Seed branch: writes LAUNCH_STATE (0x8f30) = 2 and the chosen enemy-target record byte
 *     (ENEMY_TARGET_REC0 0x8c90 / ENEMY_TARGET_REC1 0x8ca8) = 2, queues sound 0x0a, repaints the
 *     arrow tile, conditionally lights LAUNCH_HUD_TILE (0x8508), and seeds three record fields
 *     (loc_8a99 = 1, loc_8a9e = loc_8a86 + 0x0c, loc_8aa7 = 0x10).
 *   On the HUD-not-lit sub-path the hardware instead runs an `ex af,af'` then `add a,l`, which
 *   touch only the CPU's shadow accumulator; nothing consumes that result and no memory changes,
 *   so that sub-path has no lasting effect and is not modelled here.
 */

const ARROW_Y_GATE = 0x34; //     at/above this the arrow animates; below it seeds a hunter
const FLIP_RESEED = 0x10; //      flip countdown reload value
const HUNTER_STATE = 0x02; //     launch state + record marker written when a slot is seeded
const HUD_TILE = 0x10; //         tile written into the HUD cell when lit
const SEED_Y_BIAS = 0x0c; //      bias added to the source coordinate for the seeded field

export function spawnEnemyTargetOrAnimateLaunchFlipTile(m) {
  const { mem8 } = m;

  // ── Fork on the arrow's height ────────────────────────────────────────────────
  // ARROW_Y (0x8ab4) is the arrow object's Y and shrinks as it climbs. While it is still at or
  // above the gate height 0x34 the arrow is in flight, so this frame just advances its flapping
  // animation; only once it falls below the gate does the handler drop through to spawn a hunter.
  if (mem8[ARROW_Y] >= ARROW_Y_GATE) {
    // Flip animation is paced by LAUNCH_FLIP_COUNTDOWN (0x892f), a small per-frame down-counter.
    // Decrement it this frame; while it has not yet hit zero the tile is left as-is and the
    // handler returns — the arrow holds its current frame between flips.
    mem8[LAUNCH_FLIP_COUNTDOWN] = mem8[LAUNCH_FLIP_COUNTDOWN] - 1;
    if (mem8[LAUNCH_FLIP_COUNTDOWN] !== 0) return; // countdown not yet elapsed

    // Countdown reached zero: it is time to flip. Reload it to 0x10 frames for the next flip and
    // step SHARED_PHASE_COUNTDOWN (0x892e), the phase byte whose parity picks which of the two
    // arrow tiles is shown — so successive flips alternate the two frames of the flap.
    mem8[LAUNCH_FLIP_COUNTDOWN] = FLIP_RESEED;
    mem8[SHARED_PHASE_COUNTDOWN] = mem8[SHARED_PHASE_COUNTDOWN] + 1;

    // Even/odd phase selects the ROM tile-block source: LAUNCH_TILE_SRC (0x2d51) on odd, its
    // sibling LAUNCH_TILE_SRC_ALT (0x2d55) on even. Blit the chosen 2x2 block to the arrow's
    // fixed VRAM anchor LAUNCH_TILE_VRAM (0x84a7) and finish the frame.
    const src = mem8[SHARED_PHASE_COUNTDOWN] & 0x01 ? LAUNCH_TILE_SRC : LAUNCH_TILE_SRC_ALT;
    return blit2x2TileBlock(m, LAUNCH_TILE_VRAM, src);
  }

  // ── Below the gate: try to claim an enemy-target record ───────────────────────
  // The arrow has finished rising. The hunter it becomes needs one of the two I-parity
  // enemy-target records ENEMY_TARGET_REC0 (0x8c90) / ENEMY_TARGET_REC1 (0x8ca8); a record is
  // free when its state byte reads 0. Scan the pair in order for the first free one. If both are
  // already occupied there is nowhere to put the new hunter, so bail and try again next frame.
  const free = [ENEMY_TARGET_REC0, ENEMY_TARGET_REC1].find((rec) => mem8[rec] === 0);
  if (free === undefined) return; // no free target record

  // A slot is free — commit the spawn. Advance the launch machine to state 2
  // (spawnHunterIntoTableAndAdvanceLaunch, which seats the actual hunter record) by writing
  // LAUNCH_STATE (0x8f30) = 2, and mark the claimed record itself with the same 0x02 so it reads
  // occupied on the next scan.
  mem8[LAUNCH_STATE] = HUNTER_STATE;
  mem8[free] = HUNTER_STATE;

  // Announce the spawn: request sound effect 0x0a (dropped into the sound-command ring for the
  // audio processor), and repaint the arrow's 2x2 tile at LAUNCH_TILE_VRAM (0x84a7) from the
  // alternate source LAUNCH_TILE_SRC_ALT (0x2d55) — the fixed "just spawned" frame.
  queueSoundCommand0A(m);
  blit2x2TileBlock(m, LAUNCH_TILE_VRAM, LAUNCH_TILE_SRC_ALT);

  // Light the launch HUD cell only when the machine is in an idle/attract mode: if either the
  // play-mode latch PLAY_MODE_LATCH (0x8f50) or the launch-armed flag LAUNCH_ARMED_FLAG (0x8f3f)
  // is set, stamp tile 0x10 into the status-panel cell LAUNCH_HUD_TILE (0x8508).
  if ((mem8[PLAY_MODE_LATCH] | mem8[LAUNCH_ARMED_FLAG]) !== 0) mem8[LAUNCH_HUD_TILE] = HUD_TILE;

  // Seed the new record's opening fields so state 2 can carry it: mark loc_8a99 active (=1), set
  // loc_8a9e to a biased copy of the source coordinate at loc_8a86 (source + 0x0c), and prime
  // loc_8aa7 with 0x10. With these written the hunter is ready for the state-2 handler.
  mem8[loc_8a99] = 0x01;
  mem8[loc_8a9e] = mem8[loc_8a86] + SEED_Y_BIAS;
  mem8[loc_8aa7] = 0x10;
}
