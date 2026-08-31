// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import { advanceActorAnimationsUnlessGrabbing } from "./advanceActorAnimationsUnlessGrabbing.js";
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { setActorAnimation } from "./setActorAnimation.js";
import {
  ACTOR_TABLE,
  ENEMY_ACTOR_TABLE,
  PLAY_MODE_LATCH,
  ROUND_COUNTER,
  TILE_ANIM_CURSOR,
  FLIP_SCREEN_FLAG,
  ANIM_SCRIPT_CURSOR,
  GAME_ACTIVE_FLAG,
  LAUNCH_ARMED_FLAG,
  PLAY_STATE_INDEX,
  DISPLAY_MSG_BUF,
  TARGET_GROUP_COUNT,
  ANIM_TABLE_3829,
  WAVE_SEED_TABLE_1E34,
  WAVE_SEED_TABLE_1E2C,
  WAVE_TILE_CURSOR_84F6,
  WAVE_TILE_CURSOR_84E9,
  ANIM_SCRIPT_26C9,
  INTRO_MSG_STRING_183F,
  SPAWN_TILE_TABLE_70EB,
} from "./names.js";
/**
 * spawnEnemyWave — play-state idx3 handler: enemy-wave setup + spawn.
 *
 * WHAT IT IS
 *   The one-shot setup pass that lays out a fresh attack wave. Pooyan's in-play logic is a small
 *   state machine indexed by PLAY_STATE_INDEX (0x880a): each frame the active-play dispatcher runs
 *   the handler for the current index. Index 3 is this routine. It runs to build the wave — choose
 *   its data tables, seed the actor records, prime the sprite group — and then rewrites
 *   PLAY_STATE_INDEX so the very next frame no longer lands here. So although the dispatcher would
 *   call it every frame, it is in practice a transition step that fires once and moves the machine on.
 *
 * ROLE IN THE MACHINE
 *   It sits between the level-start setup (an earlier sub-state, which forces the index to 3) and
 *   active gameplay (index 4). It populates the actor regions that the per-frame drivers then walk:
 *   the four lead/enemy records at ACTOR_TABLE (0x8a80, stride 0x18) that every wave uses, and — on
 *   the attack-wave path — a fan-out of up to eight enemy sprites at ENEMY_ACTOR_TABLE (0x8ae0). The
 *   records stamped here are what the actor-state and animation drivers later march to arrival.
 *
 * ROM: 0x17c1-0x18ae.
 * Grounding: [seen].
 *
 * LIVE-OUT: none — a void state handler. Every effect lands in work RAM: the published tile-anim
 *   cursor TILE_ANIM_CURSOR (0x88be), the seeded records at ACTOR_TABLE / ENEMY_ACTOR_TABLE, the
 *   shared script cursor ANIM_SCRIPT_CURSOR (0x8f00), the group size in TARGET_GROUP_COUNT (0x8f47),
 *   the intro string in DISPLAY_MSG_BUF (0x89f0), and — always — the next PLAY_STATE_INDEX (0x880a),
 *   set to 0x12 (bonus dispatcher), advanced by one (into active play), or forced to 0x0f.
 */

// The lead/enemy actor arrays are fixed-pitch record tables. Four records are always seeded here
// (ACTOR_TABLE, slot 0 being the lead actor), and every record — in both ACTOR_TABLE and the
// ENEMY_ACTOR_TABLE fan-out — is 0x18 bytes wide, so advancing a cursor by RECORD_STRIDE steps it
// to the next record.
const SEED_COUNT = 4; // actor records seeded
const RECORD_STRIDE = 0x18; // actor-record pitch

export function spawnEnemyWave(m) {
  const { mem8, mem16 } = m;

  // ── Step 1: choose the wave's data tables ────────────────────────────────────────────────────
  // Two inputs pick where this wave's per-record seed bytes and its on-screen tile animation come
  // from. PLAY_MODE_LATCH (0x8f50) separates the intro/main-play path (0) from an attack-wave path
  // (nonzero); when it is clear, the low bit of ROUND_COUNTER (0x8907) alternates the layout each
  // round so consecutive rounds do not start identically. Two ROM tables are the candidates: the
  // even/latched table (0x1e34) with tile cursor 0x84e9, and the odd-round table (0x1e2c) with tile
  // cursor 0x84f6. Only an odd round on the main-play path takes the odd-round variant; every other
  // case uses the even/latched pair.
  let seedTable, animCursor;
  if (mem8[PLAY_MODE_LATCH] !== 0) {
    seedTable = WAVE_SEED_TABLE_1E34;
    animCursor = WAVE_TILE_CURSOR_84E9;
  } else if ((mem8[ROUND_COUNTER] & 0x01) !== 0) { // odd round
    seedTable = WAVE_SEED_TABLE_1E2C;
    animCursor = WAVE_TILE_CURSOR_84F6;
  } else { // even round
    seedTable = WAVE_SEED_TABLE_1E34;
    animCursor = WAVE_TILE_CURSOR_84E9;
  }
  // The chosen cursor is a VRAM address value, not a table: publishing it to TILE_ANIM_CURSOR
  // (0x88be) hands the per-frame tile animator the position from which it marches, cycling the
  // wave's on-screen tiles.
  mem16[TILE_ANIM_CURSOR] = animCursor;

  // ── Step 2: seed four actor records from the selected ROM table ──────────────────────────────
  // Walk the four records at ACTOR_TABLE (0x8a80), stride 0x18. Each record is stamped active
  // (byte0 = 0x01) and takes two consecutive bytes from the seed table into its +4 and +6 fields —
  // the record's initial layout for this wave. The source pointer advances one byte after each read,
  // so record N consumes the table's Nth pair.
  let rec = ACTOR_TABLE;
  let src = seedTable;
  for (let i = 0; i < SEED_COUNT; i++) {
    mem8[rec] = 0x01;
    mem8[rec + 0x04] = mem8[src]; src = u16(src + 1);
    mem8[rec + 0x06] = mem8[src]; src = u16(src + 1);
    rec = u16(rec + RECORD_STRIDE);
  }

  // Orientation fix-up. FLIP_SCREEN_FLAG (0x881f) holds the screen orientation: 1 for the normal
  // upright cabinet, 0 for the mirrored orientation (the value that gates the vertical-mirror pass).
  // In the mirrored case the lead record (slot 0) needs its +6 field pulled down by two so the wave
  // lines up in the flipped frame. Only record 0 is touched.
  if (mem8[FLIP_SCREEN_FLAG] === 0) { // mirrored orientation: nudge record 0's +6 field down two
    mem8[ACTOR_TABLE + 0x06] = u8(mem8[ACTOR_TABLE + 0x06] - 2);
  }

  // ── Step 3: seat the shared animation-script cursor, then step the animators ─────────────────
  // ANIM_SCRIPT_CURSOR (0x8f00) is the single cursor the actor animators read to know which ROM
  // animation script drives them; seat it at the wave's script 0x26c9. advanceActorAnimationsUnlessGrabbing
  // then steps the four actor records' animation scripts one entry — but only if a rope-grab is not
  // in progress, so a wave that arms during a catch does not disturb the grab animation.
  mem16[ANIM_SCRIPT_CURSOR] = ANIM_SCRIPT_26C9;
  advanceActorAnimationsUnlessGrabbing(m);

  // ── Step 4a: main-play branch (PLAY_MODE_LATCH == 0) ─────────────────────────────────────────
  // The intro/main-play path. Two outcomes, decided by whether a launch is armed before the game is
  // live.
  if (mem8[PLAY_MODE_LATCH] === 0) {
    // Not yet in a live game (GAME_ACTIVE_FLAG 0x8806 clear) but a launch is armed
    // (LAUNCH_ARMED_FLAG 0x8f3f set): hand off to play-state 0x12, the bonus dispatcher, and stop —
    // no intro string is written on this path.
    if (mem8[GAME_ACTIVE_FLAG] === 0 && mem8[LAUNCH_ARMED_FLAG] !== 0) {
      mem8[PLAY_STATE_INDEX] = 0x12;
      return;
    }
    // Otherwise advance the play-state by one (index 3 -> 4, into active gameplay) and paint the
    // wave's intro banner. The ROM string at 0x183f is copied into the display message buffer
    // DISPLAY_MSG_BUF (0x89f0) with each byte biased by -0x88 (the ROM stores it offset so the raw
    // bytes double as a compact form); the copy runs until the 0x43 ('C') sentinel, which is not
    // itself written. This branch does not reach the group fan-out below — it returns from the loop.
    mem8[PLAY_STATE_INDEX] = u8(mem8[PLAY_STATE_INDEX] + 1);
    let s = INTRO_MSG_STRING_183F;
    let dst = DISPLAY_MSG_BUF;
    for (;;) {
      const ch = mem8[s];
      if (ch === 0x43) return; // 'C' terminator ends the copy
      mem8[dst] = u8(ch - 0x88); // biased copy
      s = u16(s + 1);
      dst = u16(dst + 1);
    }
  }

  // ── Step 4b: attack-wave branch (PLAY_MODE_LATCH != 0) — fan out the enemy sprite group ───────
  // Reached only on the attack-wave path (the main-play branch above always returns). The group is
  // built only when bit 1 of ROUND_COUNTER (0x8907) is set; other rounds fall straight through to
  // the state-arm at the end, spawning no group.
  if ((mem8[ROUND_COUNTER] & 0x02) !== 0) {
    // Group size and tile choice scale with the round. Halving the round counter and comparing to 7
    // clamps the ramp: below 7, the tile index is (round >> 2) & 3 (0..3) and the group holds 5..8
    // members; at or above 7 both saturate (group 8, tile index 3). So later rounds throw larger,
    // more-varied groups until the cap.
    const half = mem8[ROUND_COUNTER] >> 1;
    let groupSize, tileIndex;
    if (half < 0x07) {
      tileIndex = (half >> 1) & 0x03;
      groupSize = tileIndex + 0x05;
    } else { // saturate
      groupSize = 0x08;
      tileIndex = 0x03;
    }
    // Record the group size in TARGET_GROUP_COUNT (0x8f47): the end-of-level bonus logic scales it x5
    // into the HUD and compares it against the hit tally to decide whether the wave was cleared.
    mem8[TARGET_GROUP_COUNT] = groupSize;
    // Fetch the group's tile-base word from the ROM word table SPAWN_TILE_TABLE_70EB (0x70eb),
    // indexed by the tile index. Its two bytes drive the per-slot coordinate/tile packing below:
    // the high byte (hi) seeds each sprite's tile field, the low byte (lo) carries the per-slot step
    // amounts split across its nibbles.
    const word = fetchWordFromTableIndex(m, tileIndex, SPAWN_TILE_TABLE_70EB); // tile-base word for the group
    let hi = (word >> 8) & 0xff;
    const lo = word & 0xff;
    let cAcc = 0x00;               // running position accumulator (starts at 0)
    let slot = ENEMY_ACTOR_TABLE;  // first enemy sprite record
    // Seat each of the group's sprite records in turn. The layout is packed compactly: rather than a
    // per-slot coordinate table, each slot's position and tile are stepped from the previous slot by
    // the two nibbles of lo, so the members march out evenly spaced across the row.
    for (let i = 0; i < groupSize; i++) {
      mem8[slot + 0x05] = 0x80;   // +5: initial sub-position / phase
      mem8[slot] = 0x01;          // +0: stamp the record active
      mem8[slot + 0x06] = 0x04;   // +6: row/column field, fixed for the group
      mem8[slot + 0x04] = hi;     // +4: tile field seeded from the running tile high byte
      hi = u8(hi + (lo & 0x0f));  // step the tile high byte by lo's low nibble for the next slot
      // Accumulate lo's high nibble into the 8-bit position accumulator; the sum's low byte is this
      // slot's packed position (+3), and any overflow past 0xff is the signal to advance to the next
      // tile bank.
      const sum = cAcc + (lo & 0xf0);
      cAcc = sum & 0xff;
      mem8[slot + 0x03] = cAcc;   // +3: packed per-slot position
      if (sum > 0xff) { // carry ripples into the tile high byte
        mem8[slot + 0x04] = u8(mem8[slot + 0x04] + 1);
        hi = u8(hi + 1);
      }
      // Point this record at the 4-frame animation table ANIM_TABLE_3829 (0x3829) and restart it, so
      // the sprite is already animating from frame 0 when the actor drivers pick it up.
      setActorAnimation(m, slot, ANIM_TABLE_3829);
      slot = u16(slot + RECORD_STRIDE); // advance to the next enemy record
    }
  }
  // Hand the machine on: force play-state 0x0f. On the attack-wave path this is the sub-state that
  // begins releasing the seeded wave, so the next frame no longer re-runs this setup.
  mem8[PLAY_STATE_INDEX] = 0x0f;
}
