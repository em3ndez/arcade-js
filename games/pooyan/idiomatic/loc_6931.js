// SPDX-License-Identifier: GPL-3.0-only
import { setActorAnimation } from "./setActorAnimation.js";
import { enqueueDisplayCommand } from "./enqueueDisplayCommand.js";
import { queueRoundSoundCommandRun } from "./queueRoundSoundCommandRun.js";
import {
  ANIM_TABLE_3838,
  SHARED_FRAME_DELAY_TIMER,
  WAVE_NUMBER,
  WAVE_ARRIVAL_COUNTER,
  WAVE_COUNT_HUD_HI,
  WAVE_SPAWN_DISPLAY_CMD_A,
  WAVE_SPAWN_DISPLAY_CMD_B,
} from "./names.js";

// After a spawn the machine reloads the shared per-frame delay counter (0x8929) with this value, so
// the sweep that calls in here waits 0x10 frames before it will spawn the next enemy of the wave.
const RESPAWN_DELAY = 0x10; //     reseeded into the shared delay timer after a spawn
// The two arrival-count HUD digits sit one tile column apart. On this hardware a column step in the
// tile map is 0x20 bytes, and the low digit is drawn in the column immediately before the high one,
// so its VRAM cell is the high-digit cell minus 0x20.
const HUD_COLUMN_STRIDE = 0x20; // the low digit tile sits one column below the high digit

// bcdInc — add 1 to a packed two-digit BCD byte, wrapping mod 100 (0x99 -> 0x00).
//
// A packed-BCD byte holds one decimal digit per nibble: the tens in the high nibble, the units in
// the low. Incrementing means bumping the low nibble, and when it passes 9 carrying a ten into the
// high nibble; when the high nibble passes 9 the whole value wraps back to 0. This mirrors the Z80
// "add 1 then decimal-adjust (daa)" the original count loop runs on each step, so the JS count below
// produces exactly the byte the machine would.
function bcdInc(v) {
  let lo = (v & 0x0f) + 1;
  let hi = v >> 4;
  if (lo > 9) {
    lo = 0;
    hi += 1;
  }
  if (hi > 9) hi = 0;
  return ((hi << 4) | lo) & 0xff;
}

/**
 * loc_6931 — per-record spawn/init for ONE enemy record pair. ROM 0x6931-0x69ac.
 * Grounding: [seen].
 *
 * WHAT IT IS
 *   The single-record worker of the wave enemy-spawn sweep. Enemies in a wave are tracked by PAIRS
 *   of records: an ENEMY_ACTOR_TABLE (0x8ae0) record holds the on-screen actor, and a paired state
 *   record holds its motion/animation state. The sweep spawnPairedEnemyOnDelaySweep (0x6905) walks
 *   eight such pairs, handing each pair (ix = enemy record, iy = state record) to this routine in
 *   turn. This routine either passes over an already-live pair or claims an empty one and brings a
 *   new enemy into the world.
 *
 * ITS ROLE IN THE MACHINE
 *   It is the point at which a wave enemy actually comes into being: the two records are marked live,
 *   their position / motion / animation fields are seeded, the actor is pointed at its spawn-in
 *   animation, and the shared respawn delay is reloaded so the next spawn is held off. The very
 *   first spawn of a wave additionally announces the wave — it queues two wave display commands,
 *   paints the wave's enemy count onto the HUD as two BCD digits, and fires the round's sound run.
 *   WAVE_NUMBER (0x892d) is then bumped to record that one more enemy of the wave has been placed.
 *   It belongs to the [seen] spawn sweep spawnPairedEnemyOnDelaySweep (0x6905), and every cell,
 *   table, and helper it touches carries a [seen] cert in the name registry.
 *
 * CONTROL SIGNAL TO THE CALLER
 *   Returns TRUE when the pair was already live ("nothing to do here — keep sweeping the rest") and
 *   FALSE the moment it spawns ("a slot was claimed — stop the sweep"), so at most one enemy is
 *   placed per sweep. In the original the same one-spawn-per-pass rule was expressed by returning two
 *   levels up (a skip return) out of the sweep on a spawn; here it is the plain boolean the caller
 *   loops on.
 *
 * The count -> BCD conversion counts single increments and follows the original count-down loop's
 * djnz semantics faithfully: a zero count is NOT a no-op but runs the full 256-step wrap (the loop
 * decrements the counter FIRST and stops at zero, so a starting value of 0 walks all 256 steps,
 * landing on 256 mod 100 = BCD 0x56).
 *
 * LIVE-OUT: none in registers — the caller protects its own loop counter/stride and advances the
 * record pointers itself, so nothing the spawn leaves in registers is read back. Memory: the two
 * records' fields, the respawn delay, and (first spawn only) the display ring, the HUD digits,
 * and WAVE_NUMBER.
 */
export function loc_6931(m, ix = m.regs.ix, iy = m.regs.iy) {
  const { mem8 } = m;

  // LIVENESS GATE (ROM 0x6931-0x6939). The enemy record's first two bytes double as active flags:
  // bit 0 of either byte set means the pair is already in use. The original ORs the two header
  // bytes and rotates bit 0 into carry (ld a,(ix+0) / or (ix+1) / rrca / ret c). If the pair is
  // live, leave it completely untouched and report TRUE so the sweep moves on to the next pair.
  if (((mem8[ix] | mem8[ix + 1]) & 0x01) !== 0) return true; // already active -> keep sweeping

  // CLAIM THE PAIR AND SEED ITS FIELDS (ROM 0x693a-0x696f). The slot is empty, so lay down a fresh
  // enemy. First the original zeroes two working fields (xor a then store), then increments A to 1
  // and stamps that 1 into BOTH record headers to mark the pair live; the remaining stores drop the
  // constant seed values into the position / motion / animation fields at their fixed offsets.
  mem8[ix + 0x03] = 0x00;
  mem8[ix + 0x05] = 0x00;
  mem8[ix + 0x00] = 0x01; // activate the enemy record
  mem8[iy + 0x00] = 0x01; // activate the paired state record
  mem8[ix + 0x04] = 0x15;
  mem8[ix + 0x06] = 0x1e;
  mem8[iy + 0x03] = 0x80;
  mem8[iy + 0x05] = 0xa0;
  mem8[iy + 0x04] = 0x14;
  mem8[iy + 0x06] = 0x1e;
  mem8[iy + 0x0f] = 0x03;
  mem8[iy + 0x10] = 0x40;
  mem8[ix + 0x09] = 0x24;
  mem8[iy + 0x09] = 0x24;
  // ARM THE SPAWN-IN ANIMATION (ROM 0x6972-0x6975). Point the newly live actor at ANIM_TABLE_3838
  // (the 4-frame descending-object sequence) and restart it at frame 0, so the enemy plays its
  // arrival animation from the top. The original loads de = 0x3838 and calls the shared retargeter.
  setActorAnimation(m, ix, ANIM_TABLE_3838);
  // HOLD OFF THE NEXT SPAWN (ROM 0x6977-0x697a). Reload the shared per-frame delay counter (0x8929)
  // to 0x10; the calling sweep decrements this every frame and will not spawn again until it drains,
  // pacing the wave so enemies enter one at a time rather than all at once.
  mem8[SHARED_FRAME_DELAY_TIMER] = RESPAWN_DELAY;

  // FIRST SPAWN OF THE WAVE? (ROM 0x697d-0x697e). WAVE_NUMBER (0x892d) counts enemies already placed
  // in the current wave; while it is still zero this is the wave's opening enemy, and only then do
  // the one-time wave announcements below run. The original tests it and jr-nz past this whole block.
  if (mem8[WAVE_NUMBER] === 0) { // first spawn of the wave
    // ANNOUNCE THE WAVE (ROM 0x6980-0x6987). Queue two display commands into the command ring — the
    // wave's setup/paint pair (0x0625 and 0x060a) — which the display consumer drains next frame.
    enqueueDisplayCommand(m, WAVE_SPAWN_DISPLAY_CMD_A);
    enqueueDisplayCommand(m, WAVE_SPAWN_DISPLAY_CMD_B);

    // COUNT -> BCD (ROM 0x698a-0x6994). Convert the wave's arrival count WAVE_ARRIVAL_COUNTER (0x8903)
    // from a plain binary byte into a packed two-digit BCD value for display. The original loads the
    // count into B, clears A, then repeatedly does "add 1 / daa / djnz" — B single-step BCD increments
    // — so the accumulator ends holding the count in packed BCD. See bcdInc / the djnz note above for
    // the zero-count full-wrap behaviour this do/while preserves.
    let bcd = 0x00;
    let steps = mem8[WAVE_ARRIVAL_COUNTER];
    do {
      bcd = bcdInc(bcd);
      steps = (steps - 1) & 0xff;
    } while (steps !== 0);
    // PAINT THE TWO HUD DIGITS (ROM 0x6995-0x69a4). Split the packed BCD into its two nibbles and
    // write each as a tile code. The high digit (tens) goes to WAVE_COUNT_HUD_HI (0x863b); the low
    // digit (units) goes one tile column earlier, at 0x863b - 0x20. The original isolates the high
    // nibble with and 0xf0 then four rrca's to shift it down, and the low nibble with and 0x0f.
    mem8[WAVE_COUNT_HUD_HI] = (bcd & 0xf0) >> 4; //          high digit
    mem8[WAVE_COUNT_HUD_HI - HUD_COLUMN_STRIDE] = bcd & 0x0f; // low digit

    // WAVE SOUND (ROM 0x69a7, call 0x0f97). Queue the round-derived sound run that plays as the wave
    // opens; the leading command byte is picked from ROUND_COUNTER so the fanfare varies by round.
    queueRoundSoundCommandRun(m);
  }

  // RECORD THE PLACEMENT (ROM 0x69aa-0x69ab). Bump WAVE_NUMBER (0x892d): one more enemy of the wave
  // has now been spawned. The gate above uses this both to skip the announcements after the first
  // enemy and (in the caller) to know when the whole wave has been placed.
  mem8[WAVE_NUMBER] = mem8[WAVE_NUMBER] + 1;
  return false; // spawned -> caller aborts its sweep
}
