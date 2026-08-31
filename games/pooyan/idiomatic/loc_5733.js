// SPDX-License-Identifier: GPL-3.0-only
import { adjustSpawnColumn } from "./adjustSpawnColumn.js";
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { setActorAnimation } from "./setActorAnimation.js";
import { decrementPhaseCounterAndDispatchSpawnOrStep } from "./decrementPhaseCounterAndDispatchSpawnOrStep.js";
import {
  ROUND_COUNTER,
  DIFFICULTY_DSW,
  GAUGE_PHASE_COUNTER,
  SPAWN_COLUMN_BIAS,
  SPAWN_FIELD_TABLE,
  SPAWN_FIELD_TABLE_ODD,
  ENEMY_SPAWN_TIMER,
  SPAWN_TIMER_TABLE_ODD,
  SPAWN_TIMER_TABLE_EVEN,
  ACTIVE_ENEMY_COUNT,
  ANIM_TABLE_3829,
} from "./names.js";
/**
 * loc_5733 — the spawn body: initialise one actor slot and bring the new enemy to life.
 *
 * WHAT IT IS
 *   The inner half of the per-slot spawn routine, entered directly — past the "is this slot
 *   already live?" prologue that guards it. Its two entry points are loc_572b (the guarded whole,
 *   used when a caller is sweeping the six actor slots) and this body (used when a caller has
 *   already picked an empty slot and just wants it filled). Everything from here on assumes the
 *   slot at IX is free and is to be stamped with a fresh enemy.
 *
 *   It does four things in order: (1) stamps the record's opening state/timer/flag fields;
 *   (2) builds a single spawn-column index by folding together the difficulty setting, an
 *   optional late-round gauge bias, an early-stage wave shift, and the round number, then clamping
 *   it below the arena width; (3) uses that one column to read two round-parity byte tables — the
 *   first supplies the enemy's motion increment (and its two's-complement partner), the second the
 *   next spawn-timer reload; (4) points the record at its animation sequence, bumps the count of
 *   live enemies, and drops into the start-of-scan state machine on the entry seed column.
 *
 * ROLE IN THE MACHINE
 *   This is how a new enemy enters the round. The spawn cadence timer (ENEMY_SPAWN_TIMER) ticks
 *   down each frame; when it hits zero a scan finds a free actor slot and lands here to populate
 *   it. The single column index is the difficulty knob for that one enemy: harder settings, later
 *   rounds, and a drained phase gauge all shift it, and the shift selects both how fast the enemy
 *   moves and how soon the next one is due — so the field gets busier as play advances.
 *
 * ROM 0x5733 (0x5733-0x57b3).
 * Grounding: [seen].
 *
 * SEATING: caller-skip. In the machine this body discards its own return address and returns one
 * level up — past the immediate caller that invoked it — so a caller sweeping the actor slots
 * never resumes its loop after a spawn: exactly one actor is spawned per scan. Callers therefore
 * place no epilogue after invoking it.
 *
 * LIVE-OUT: memory only, no register result. It leaves behind the fully initialised actor record
 * at IX, the reloaded spawn-cadence timer (ENEMY_SPAWN_TIMER), and the incremented live-enemy
 * tally (ACTIVE_ENEMY_COUNT); the start-of-scan state machine it tails into writes the rest.
 */

const CLAMP_DIFFICULTY = 0x03; // difficulty index is clamped to this ceiling before it feeds the column
const GAUGE_BIAS_THRESHOLD = 0x04; // once the phase gauge has drained to <4 remaining, the column bias is folded in
const COLUMN_MAX = 0x20; // arena is 0x20 columns wide; the final index is capped at COLUMN_MAX - 1 (0x1f)

export function loc_5733(m, c = m.regs.c, ix = m.regs.ix, e = m.regs.e) {
  const { mem8 } = m;
  // The entry column is stashed now, before the column arithmetic below overwrites the working
  // copy. The start-of-scan state machine at the tail reads this original value to pick its branch
  // (a decrement-toward-zero countdown), so it must be captured up front and carried through
  // untouched. In the machine this is the `ld b,c` that opens the routine at ROM 0x5734.
  const stateSeed = c; // the entry column; the start-of-scan dispatch reads it after the column work

  // Stamp the fresh record's opening fields (the actor slot based at IX). This is the block of
  // stores at ROM 0x5738-0x5753 that brings a blank slot to its "just spawned" shape: mark it
  // live and in the spawn state, plant the caller's kind byte, and zero the motion/phase scratch.
  mem8[ix + 0x00] = 0x01; // +0x00 = 1: slot is now live (the low-bit "active" flag callers scan for)
  mem8[ix + 0x02] = 0x03; // +0x02 = 3: state byte -> the spawn/arrival state
  mem8[ix + 0x04] = e; // +0x04 = E: the enemy kind/field byte handed in by the caller
  mem8[ix + 0x03] = 0x00; // +0x03 = 0: clear (the following four zeroes are the `xor a` reused)
  mem8[ix + 0x05] = 0x00; // +0x05 = 0: clear sub-position / motion scratch
  mem8[ix + 0x06] = 0x00; // +0x06 = 0: clear column / phase scratch
  mem8[ix + 0x08] = 0x00; // +0x08 = 0: clear the per-actor latch byte
  mem8[ix + 0x07] = 0x01; // +0x07 = 1: flag byte (bit0 set; its bit1 later selects the turn-around anim variant)
  mem8[ix + 0x0b] = 0x00; // +0x0b = 0: clear the arm byte

  // Round parity drives every table pick below: the field and timer tables come in even/odd pairs,
  // and only the even round runs the early-stage wave shift. This is `(0x8907) & 1` at ROM 0x5759.
  const odd = mem8[ROUND_COUNTER] & 0x01;

  // Build the spawn column index. It starts from the difficulty DSW, gains an optional late-gauge
  // bias and an even-round wave shift, then the round number is added and the whole thing capped
  // below the arena width. The single resulting column indexes both the motion and timer tables,
  // so it is the one knob that scales this enemy's speed and the next spawn's delay together.
  let col = mem8[DIFFICULTY_DSW]; // ROM 0x5763: start from the 3-bit difficulty setting (0x8820)
  if (col >= CLAMP_DIFFICULTY) col = CLAMP_DIFFICULTY; // ROM 0x5765 cp 3: clamp difficulty to the 0..3 index range
  if (mem8[GAUGE_PHASE_COUNTER] >= GAUGE_BIAS_THRESHOLD) col = (col + mem8[SPAWN_COLUMN_BIAS]) & 0xff; // ROM 0x576d: with >=4 gauge phases left, fold in the column bias (0x8d4c)
  if (odd === 0) col = adjustSpawnColumn(m, col); // ROM 0x577b call z,0x57b4 — even round only: shift the column by wave progress in the early stages
  col = (mem8[ROUND_COUNTER] + col) & 0xff; // ROM 0x5781: add the round number so later rounds spawn from a deeper column
  if (col >= COLUMN_MAX) col = COLUMN_MAX - 1; // ROM 0x5785 cp 0x20: keep the index inside the 0x20-wide arena (cap at 0x1f)

  // Motion field from the round-parity field table. The rst-0x20 lookup does HL += col then reads
  // the byte there; that byte is the enemy's per-step motion increment, and its two's-complement
  // negation is stored in the mirror field so the actor can travel in either direction.
  const fieldTable = odd ? SPAWN_FIELD_TABLE_ODD : SPAWN_FIELD_TABLE; // ROM 0x5756/0x575d: HL = 0x58e0 (odd) or 0x5902 (even)
  const [motion] = fetchByteFromTableIndex(m, fieldTable, col); // ROM 0x578b rst 0x20: motion = fieldTable[col]
  mem8[ix + 0x09] = motion; // +0x09 = motion increment
  mem8[ix + 0x0a] = -motion; // +0x0a = its two's-complement partner (ROM 0x5790 neg; the Uint8Array store masks to 8 bits)

  // Point the record at its 4-frame animation sequence (attr/tile/colour loop) and restart it.
  // This is `ld de,0x3829` + the call at ROM 0x5796-0x5799.
  setActorAnimation(m, ix, ANIM_TABLE_3829);

  // Spawn timer from the round-parity timer table, read with the SAME column index. The byte it
  // yields reloads the global spawn-cadence countdown, so a deeper column both speeds this enemy
  // and shortens the wait before the next one.
  const timerTable = odd ? SPAWN_TIMER_TABLE_ODD : SPAWN_TIMER_TABLE_EVEN; // ROM 0x579c/0x57a3: HL = 0x589b (odd) or 0x58c0 (even)
  const [timer] = fetchByteFromTableIndex(m, timerTable, col); // ROM 0x57a8 rst 0x20: timer = timerTable[col]
  mem8[ENEMY_SPAWN_TIMER] = timer; // ROM 0x57ab: reload the spawn-cadence countdown (0x8d07)

  // One more enemy is on the field. ROM 0x57af inc (0x8d40): bump the live-enemy tally that the
  // spawn gates test against the per-stage threshold and the roster cap.
  mem8[ACTIVE_ENEMY_COUNT] = mem8[ACTIVE_ENEMY_COUNT] + 1;

  // Enter the start-of-scan state machine on the entry seed column captured at the top. This is the
  // call at ROM 0x57b2 to the sub-state head, which decrements its phase counter and either brings
  // the singleton special actor into being or advances the eagle-stage stepper.
  decrementPhaseCounterAndDispatchSpawnOrStep(m, stateSeed, ix); // enter the start-of-scan state machine
}
