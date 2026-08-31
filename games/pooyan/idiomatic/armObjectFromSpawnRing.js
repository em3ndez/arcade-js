// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { moveObject } from "./moveObject.js";
import { SPAWN_RING_COUNTER, SPAWN_WORD_TABLE } from "./names.js";
/**
 * armObjectFromSpawnRing — arm a fresh transient object into an idle record slot.
 *
 * WHAT IT IS
 *   The game keeps a small array of six "object" records (base 0x8ba0, stride 0x18) for
 *   the transient things that fly and slide across the playfield — a launched hunter, a
 *   dropped arrow, a rope/lift segment. Each record runs a tiny per-frame state machine
 *   whose current state lives in its state byte (rec+0x02); the low bits pick the handler
 *   that runs this frame:
 *       state 0  arm a fresh object into the slot   <-- THIS routine
 *       state 1  move it one sub-step across the field   (moveObject)
 *       state 2  draw its stacked tile pair              (drawObjectStackedTiles)
 *   This is the state-0 body. A record sits in state 0 as an empty, waiting slot: each
 *   frame it just counts down a spawn-delay timer, and only when that timer expires does it
 *   actually populate the slot with a new object and promote it to the moving state.
 *
 * ROLE IN THE MACHINE
 *   Reached once per frame for a record parked in state 0, driven from the per-object state
 *   sweep that walks the six object records and runs each one's current-state handler. This
 *   is the birth event for playfield objects: it decides *when* a new object appears (the
 *   +0x11 countdown paces the drip of spawns) and *what* it is (the next entry of the spawn
 *   program, pulled from the spawn ring, decides which shape/behaviour word the object gets).
 *
 * ROM 0x771d-0x773f.  Grounding: [seen].
 *
 * LIVE-OUT: none (memory only). Everything it produces is written into the object record
 *   (the countdown at +0x11, the spawn index at +0x13, the spawn word at +0x15/+0x16, the
 *   speed at +0x0a, and the bumped state byte at +0x02) and the shared spawn ring counter.
 */
export function armObjectFromSpawnRing(m, record = m.regs.ix) {
  const { mem8 } = m;

  // Spawn-delay gate. rec+0x11 is a per-record frame countdown: while the slot is waiting to
  // spawn it decrements this byte once per frame and does nothing else, so a slot seeded with
  // a delay stays empty for that many frames. The subtraction is taken as an
  // 8-bit wrap (matching the hardware's dec of a memory byte). Only when it reaches exactly 0
  // does the slot proceed to arm an object this frame; any nonzero value means "keep waiting".
  const countdown = (mem8[record + 0x11] - 1) & 0xff; // rec+0x11: spawn-delay countdown
  mem8[record + 0x11] = countdown;
  if (countdown !== 0) return; // still counting down -> leave the slot empty this frame

  // Pull the next entry of the spawn program. SPAWN_RING_COUNTER (0x8d57) is a single shared
  // cursor read-and-incremented on every arm, so successive objects step through the spawn
  // program in order; it wraps naturally as a byte and is reset to 0 at a spawn-phase change.
  // The index this slot draws is stamped into the record at rec+0x13 so the object remembers
  // which spawn entry it came from.
  const spawnIndex = mem8[SPAWN_RING_COUNTER]; // 0x8d57: shared spawn-program cursor
  mem8[SPAWN_RING_COUNTER] = spawnIndex + 1; // advance the ring for the next object armed
  mem8[record + 0x13] = spawnIndex; // rec+0x13: remember this object's spawn index

  // Look up this object's defining 16-bit word from the per-spawn-index word table
  // (SPAWN_WORD_TABLE, 0x7869). The table holds one little-endian word per index, so the byte
  // offset is index*2 (kept to a byte, matching the 8-bit index arithmetic). The low byte is
  // fetched at base+offset and stored at rec+0x15; the high byte lives in the very next table
  // slot (the pointer left parked on the low byte, +1) and is stored at rec+0x16. This word is
  // the object's identity — the shape/behaviour data the later states read back out.
  const [wordLow, ptr] = fetchByteFromTableIndex(m, SPAWN_WORD_TABLE, (spawnIndex * 2) & 0xff);
  mem8[record + 0x15] = wordLow; // rec+0x15: spawn word, low byte
  mem8[record + 0x16] = mem8[u16(ptr + 1)]; // rec+0x16: spawn word, high byte (next table slot)

  // Seed the object's motion speed. rec+0x0a is the signed per-frame speed the mover applies
  // each step; 0xec (-20) starts the freshly-armed object travelling at its launch velocity.
  mem8[record + 0x0a] = 0xec; // rec+0x0a: initial signed step speed

  // Promote the slot out of the arming state. Bumping the state byte moves the record from
  // state 0 to state 1, so subsequent frames route the slot to the mover.
  mem8[record + 0x02] = mem8[record + 0x02] + 1; // rec+0x02: state 0 -> state 1

  // Run state 1 immediately, in this same frame. The newly-armed object does not wait a frame
  // to start travelling — control continues straight into the mover so the object also takes
  // its first move step this frame, the frame it is born.
  return moveObject(m, record); // continue into the state-1 mover this frame
}
