// SPDX-License-Identifier: GPL-3.0-only
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import {
  FORMATION_SPAWN_INDEX,
  ACTOR_MOTION_TABLE_55D4,
  ACTOR_SPEED_TABLE_55D7,
  ACTOR_ANIM_SCRIPT_TABLE_561F,
  ACTOR_ANIM_TABLE_5657,
} from "./names.js";
/**
 * initEnemyFormationRecord — bring one enemy-formation actor to life in its record.
 * ROM 0x5433-0x5488. [seen]
 *
 * WHAT IT IS
 * A one-shot initialiser for a single actor record in the enemy-formation pool. The caller
 * points IX at the 0x18-byte record it wants to populate; this routine turns that empty slot
 * into a fully-armed enemy: it marks the slot live, seeds its starting position and state,
 * pulls the enemy's motion / speed / animation parameters out of four parallel ROM tables,
 * primes the animation so a picture is on screen the very first frame, and then steps a shared
 * cursor so the next slot to be initialised draws the next table entry.
 *
 * ROLE IN THE MACHINE
 * The whole formation is described by four ROM tables laid out in parallel — one entry per
 * enemy to spawn. A single work-RAM cursor, FORMATION_SPAWN_INDEX (0x8d01), says which entry
 * is up next. Each call consumes one entry (reading all four tables at the same index) and
 * bumps the cursor, so repeated calls walk the formation description front to back, stamping
 * successive enemies with successive parameter sets. The record itself is one slot of the
 * uniform 0x18-byte actor arena, so once initialised it is driven by the ordinary per-record
 * state / animation sweeps like any other actor.
 *
 * LIVE-OUT: none in registers — memory only. It leaves the initialised actor record at IX and
 * the advanced spawn cursor at FORMATION_SPAWN_INDEX.
 */

export function initEnemyFormationRecord(m, ix = m.regs.ix) {
  const { mem8 } = m;

  // Liveness guard. The record's two-byte header (+0x00 / +0x01) doubles as its presence
  // flag: if either byte is already set the slot is occupied by a live actor, so re-arming it
  // would clobber an enemy mid-flight. Bail and leave the existing record untouched.
  if ((mem8[ix] | mem8[ix + 1]) !== 0) return; // record already live

  // Stamp the fresh, constant part of the record — the fields that are the same for every
  // enemy regardless of which table entry it draws.
  mem8[ix + 0x00] = 0x01; // +0x00 presence flag -> live (marks the slot occupied)
  mem8[ix + 0x02] = 0x00; // +0x02 state index -> 0: start at the head of this actor's state machine
  mem8[ix + 0x05] = 0x00; // +0x05 -> 0: clear the paired sub-state/scratch byte
  mem8[ix + 0x03] = 0x60; // +0x03 / +0x04 seed the actor's starting on-screen position...
  mem8[ix + 0x04] = 0x1b; // ...+0x04 is the record's Y coordinate (the row it enters at)
  mem8[ix + 0x0e] = 0x00; // +0x0e animation frame-hold -> 0 so the first tick loads a frame at once

  // Which formation entry is up next. FORMATION_SPAWN_INDEX (0x8d01) is the shared cursor that
  // indexes all four parallel formation tables; this call reads every table at this one index.
  const index = mem8[FORMATION_SPAWN_INDEX];

  // Motion byte. Look the entry up in the ROM motion table at 0x55d4 (a plain byte table, one
  // byte per formation entry) and stow it at record +0x06 — the actor's movement descriptor.
  const [motion] = fetchByteFromTableIndex(m, ACTOR_MOTION_TABLE_55D4, index);
  mem8[ix + 0x06] = motion;
  // Speed byte. Look the entry up in the ROM speed table at 0x55d7, then store its negation at
  // record +0x0a: the movement code integrates position by adding this pre-negated step each
  // frame, so the stored value is the two's-complement partner of the table magnitude.
  const [speed] = fetchByteFromTableIndex(m, ACTOR_SPEED_TABLE_55D7, index);
  mem8[ix + 0x0a] = -speed; // two's-complement partner (the store keeps the low 8 bits)

  // Animation script selector. The word table at 0x561f maps the formation index to the
  // address of a one-byte animation-script id; read that id byte and record it at +0x17 (the
  // record's own copy of which animation script it runs).
  const scriptWord = fetchWordFromTableIndex(m, index, ACTOR_ANIM_SCRIPT_TABLE_561F);
  const scriptByte = mem8[scriptWord];
  mem8[ix + 0x17] = scriptByte;
  // Animation stream pointer. Feed that script id into the word table at 0x5657 to get the
  // address of the actual animation byte-stream, and seat it as the record's little-endian
  // animation cursor at +0x0c (low) / +0x0d (high) — where the sequencer reads frames from.
  const sequence = fetchWordFromTableIndex(m, scriptByte, ACTOR_ANIM_TABLE_5657);
  mem8[ix + 0x0c] = sequence; // low byte  (the store keeps the low 8 bits)
  mem8[ix + 0x0d] = sequence >> 8; // high byte

  // Prime the animation. Seed the +0x11 frame-delay/dwell pacer used by the state handlers,
  // then run the shared animation sequencer once so the record already carries a tile,
  // attribute and hold count on the frame it becomes visible (rather than a blank first frame).
  mem8[ix + 0x11] = 0x40; // +0x11 frame-delay dwell pacer
  advanceObjectAnimationFrame(m, ix); // load the first animation frame now

  // Advance the shared cursor so the next record initialised pulls the next formation entry.
  mem8[FORMATION_SPAWN_INDEX] = index + 1; // wraps at 256 (the store keeps the low 8 bits)
}
