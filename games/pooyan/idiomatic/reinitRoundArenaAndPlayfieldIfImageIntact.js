// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { fillByteRun } from "./fillByteRun.js";
import { ascendEnemyActorAndLinkedSlotOnTimer } from "./ascendEnemyActorAndLinkedSlotOnTimer.js";
import {
  HUD_INTEGRITY_STRIP_A,
  ROUND_IN_PROGRESS,
  PHASE_TIMER,
  PLAY_STATE_INDEX,
  FRAME_TIMER_BLOCK_BASE,
  ACTOR_TABLE,
  PLAYFIELD_PAINT_START,
} from "./names.js";
/**
 * reinitRoundArenaAndPlayfieldIfImageIntact  (ROM 0x67df-0x6821)  [seen]
 * ---------------------------------------------------------------------------
 * WHAT IT IS
 *   A screen re-initialiser that is allowed to run only when the picture already
 *   on the screen proves to be intact. Before it tears down and rebuilds the
 *   playing area it self-checks the on-screen colour map with a tiny checksum;
 *   an intact image is the licence to arm a fresh round, a corrupted one is
 *   treated as tamper and the routine quietly falls back to the ordinary
 *   per-frame object work instead. It is one of the ROM's several
 *   image-integrity gates.
 *
 * ROLE IN THE MACHINE
 *   The picture is built from two parallel planes over one 32x32 cell grid:
 *   colour RAM (0x8000-0x83FF) holds one attribute byte per cell and video RAM
 *   (0x8400-0x87FF) holds one tile code per cell. This routine reads the colour
 *   plane to decide whether the frame is trustworthy, then writes the tile plane
 *   (and the game-state cells and the actor arena) to lay down a clean, empty
 *   round. It is entered as one branch of the descending-object state handler,
 *   and also as the abort target of the boot-time program-signature check when
 *   that check fails.
 *
 *   On a failed integrity check it does NOT reset anything: it tail-calls the
 *   normal per-object frame updater, so the object being processed still gets
 *   its regular animation/position/state step for the frame.
 *
 * LIVE-OUT (memory only; the routine returns nothing a caller reads)
 *   On an intact image it leaves, in RAM:
 *     - ROUND_IN_PROGRESS (0x8904) = 1  (round marked live)
 *     - PHASE_TIMER       (0x8808) = 1  (phase countdown seeded)
 *     - PLAY_STATE_INDEX  (0x880a) = 1  (in-play sub-state armed)
 *     - the 9-cell per-frame timer block at 0x8928 zeroed
 *     - the whole actor/object arena from 0x8a80 (0x241 bytes) zeroed
 *     - the playfield tile plane painted to a 0x1d-by-0x1d square of the blank
 *       tile from 0x8442
 *   On a corrupt image it leaves whatever the per-object frame updater writes.
 */

const CKSUM_COUNT = 0x0a; //    colour-map cells summed
const ROW_STRIDE = 0x20; //     one tilemap row (the checksum walks up, the paint walks down)
const CKSUM_EXPECTED = 0x5a; // the clean-image sum sentinel
const ARMED = 0x01; //          flag/seed value written into the three state cells
const TIMER_BLOCK_LEN = 0x09; // per-frame timer cells cleared
const FILL_ZERO = 0x00;
const ARENA_WIPE_LEN = 0x241; // actor/object arena bytes cleared
const PAINT_TILE = 0x10; //     blank tile stamped across the playfield
const PAINT_SPAN = 0x1d; //     tiles per row and rows painted
const ROW_GAP = ROW_STRIDE - PAINT_SPAN; // step from a row's last tile to the next row's first

export function reinitRoundArenaAndPlayfieldIfImageIntact(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // --- Integrity probe: fingerprint the on-screen colour map ---------------
  // Sum ten attribute cells from the colour plane, one screen row apart. The
  // walk starts at HUD_INTEGRITY_STRIP_A (0x82bc, a colour-RAM cell) and steps
  // UP the screen by exactly one tilemap row (0x20 cells) per read, so it
  // samples the vertical strip 0x82bc, 0x829c, 0x827c, ... The running total is
  // kept as an 8-bit accumulator (wraps mod 0x100) — this is a cheap fingerprint
  // of the region, not an arithmetic value.
  let sum = 0;
  let probe = HUD_INTEGRITY_STRIP_A;
  for (let i = 0; i < CKSUM_COUNT; i++) {
    sum = (sum + mem8[probe]) & 0xff;
    probe = u16(probe - ROW_STRIDE);
  }
  // A clean, expected image sums to the sentinel 0x5a. Any other total means the
  // colour map is not what it should be, so the re-init is refused: hand the
  // current object record (rec) to the ordinary per-object frame updater — which
  // advances that object's animation, its 16-bit position and its state for the
  // frame — and return without touching game state.
  if (sum !== CKSUM_EXPECTED) {
    ascendEnemyActorAndLinkedSlotOnTimer(m, rec); // rec = this record, threaded from the enemy-scan loop
    return;
  }

  // --- Arm a fresh round ---------------------------------------------------
  // The image checked out, so declare a new round live. Three one-byte state
  // cells are stamped to 1: the round-in-progress gate (0x8904), the per-frame
  // phase countdown (0x8808), and the in-play sub-state index (0x880a). Seeding
  // the phase timer and sub-state to 1 starts the round's phase machine at its
  // first step.
  mem8[ROUND_IN_PROGRESS] = ARMED;
  mem8[PHASE_TIMER] = ARMED;
  mem8[PLAY_STATE_INDEX] = ARMED;

  // --- Wipe the volatile game memory ---------------------------------------
  // Clear the 9-cell per-frame timer block at 0x8928 so no stale phase/hold
  // countdowns survive into the new round, then zero the entire actor/object
  // arena: 0x241 bytes from ACTOR_TABLE (0x8a80), which covers the lead-actor
  // slot and every enemy/object/formation record that lives above it. Every
  // record is thus reborn empty (all slots inactive) for the new round.
  fillByteRun(m, FRAME_TIMER_BLOCK_BASE, FILL_ZERO, TIMER_BLOCK_LEN);
  for (let i = 0; i < ARENA_WIPE_LEN; i++) mem8[ACTOR_TABLE + i] = FILL_ZERO;

  // --- Repaint the playfield to a blank square -----------------------------
  // Stamp the blank tile (0x10) across the play area of the tile plane. Painting
  // starts at PLAYFIELD_PAINT_START (0x8442, a video-RAM cell) and fills a
  // 0x1d-by-0x1d square: each pass writes 0x1d blank tiles left-to-right, then
  // the cursor skips the ROW_GAP (0x20 - 0x1d = 3) cells between a row's last
  // painted tile and the next row's first, so the cursor advances one full
  // 0x20-cell screen row per pass and the paint marches DOWN the screen (whereas
  // the integrity probe above walked up it).
  let cursor = PLAYFIELD_PAINT_START;
  for (let row = 0; row < PAINT_SPAN; row++) {
    const advanced = fillByteRun(m, cursor, PAINT_TILE, PAINT_SPAN);
    cursor = u16(advanced + ROW_GAP);
  }
}
