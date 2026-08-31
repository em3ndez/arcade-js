// SPDX-License-Identifier: GPL-3.0-only
import { advanceObjectAnimationFrame } from "./advanceObjectAnimationFrame.js";
import { fetchWordFromTableIndex } from "./fetchWordFromTableIndex.js";
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { queueSoundCommand05 } from "./queueSoundCommand05.js";
import { setActorAnimation } from "./setActorAnimation.js";
import {
  ARM_ANIM_TABLE,
  INTEGRITY_GUARD_TABLE_0BB3,
  TAMPER_STRIKES_OBJMOVE,
} from "./names.js";
/**
 * moveObject — the "move" phase of a spawned object.
 *
 * WHAT IT IS
 *   A spawned playfield object (a launched hunter, a dropped arrow, a rope/lift
 *   segment — the transient things that fly or slide across the field) runs a tiny
 *   three-state machine kept in its own record. The record's state byte (rec+0x02)
 *   picks the handler each frame:
 *       state 0  arm a fresh object into the slot   (armObjectFromSpawnRing)
 *       state 1  MOVE it one sub-step across the field   <-- this routine
 *       state 2  draw its stacked tile pair          (drawObjectStackedTiles)
 *   moveObject is the state-1 body: while the object is travelling it slides along
 *   its axis by a signed per-frame speed, and every time it slides far enough to
 *   cross into the next grid cell it hands itself on to the next state, restarts its
 *   frame timer, plays a step sound, and re-points its sprite at a fresh animation.
 *
 * ROLE IN THE MACHINE
 *   Invoked once per frame for the active object record (base address in `rec`) while
 *   that record sits in state 1. It is the piece that actually makes a spawned object
 *   travel: sub-cell motion accumulates here until a cell boundary is crossed, which
 *   is the event the rest of the object's lifecycle keys off.
 *
 * ROM 0x7740-0x778f.  Grounding: [seen].
 *
 * LIVE-OUT (what it leaves in memory):
 *   - Always: the object's coarse position (rec+0x03) stepped by the speed, and the
 *     sub-position (rec+0x04) borrowed on underflow.
 *   - On a cell crossing only: the state byte (rec+0x02) advanced, the frame timer
 *     (rec+0x11) reloaded to 0x18, a step sound queued, the sprite-animation pointer
 *     re-armed, and — if the program-image guard fails — the object-mover tamper
 *     counter (0x89e9) bumped.
 *   Returns no value; the dispatcher that called it reads nothing back.
 */
export function moveObject(m, rec = m.regs.ix) {
  const { mem8 } = m;

  // Refresh the object's animation first: run the frame-hold countdown and, when it
  // lapses, walk the object's animation script one entry forward. This keeps the
  // sprite animating every frame regardless of whether the object crosses a cell below.
  advanceObjectAnimationFrame(m, rec); // step the animation sequence

  // Integrate motion. (rec+0x0a) is the object's signed per-frame speed and (rec+0x03)
  // its coarse position along the travel axis. Adding a negative speed can carry the
  // position below zero; the machine detects that by comparing the current position
  // against -speed (two's complement, 8-bit) and, when it would wrap under, borrows one
  // from the high half of the position held in the sub-position cell (rec+0x04).
  const speed = mem8[rec + 0x0a];
  const pos = mem8[rec + 0x03];
  if (pos < ((0 - speed) & 0xff)) mem8[rec + 0x04] = mem8[rec + 0x04] - 1; // underflow borrow
  mem8[rec + 0x03] = pos + speed; // position is an 8-bit cell, so the add wraps mod 256

  // Cell-boundary gate. The low 5 bits of the sub-position (rec+0x04) count the object's
  // progress through the current grid cell. While that count is still 9 or more the
  // object has not yet reached the next cell, so the per-frame move is done — leave the
  // rest of the record untouched and return.
  if ((mem8[rec + 0x04] & 0x1f) >= 0x09) return; // not across a cell yet

  // --- The object crossed into the next cell this frame: hand it on to its next phase. ---

  // Advance the record's state byte so a later frame runs the next handler in the
  // object's lifecycle, and reload the frame-hold timer that paces the new phase.
  mem8[rec + 0x02] = mem8[rec + 0x02] + 1; // advance state
  mem8[rec + 0x11] = 0x18; // reload the frame timer

  // Play the per-cell step sound (fixed sound command 0x05 posted into the audio ring).
  queueSoundCommand05(m); // enqueue sound command 5

  // Re-point the sprite at a fresh animation for the new phase: (rec+0x17) selects a
  // 16-bit animation-sequence pointer out of the arm-animation word table at 0x41b1,
  // and that pointer is installed into the record (restarting the sequence).
  setActorAnimation(m, rec, fetchWordFromTableIndex(m, mem8[rec + 0x17], ARM_ANIM_TABLE)); // store the animation pointer

  // Program-image integrity guard. Fold the low 5 bits of five bytes from the ROM guard
  // table at 0x0bb3 into a running 16-bit accumulator (each step adds the masked byte;
  // the byte fetched at the new offset is not used). An intact table makes the low byte
  // plus high byte plus 0xc7 total zero mod 256; any other total means the code image has
  // been altered.
  let acc = 0; // 5-byte checksum guard; the byte-table lookup serves only as its 16-bit add (fetched byte discarded)
  for (let i = 0; i < 5; i++) {
    const [, next] = fetchByteFromTableIndex(m, acc, mem8[INTEGRITY_GUARD_TABLE_0BB3 + i] & 0x1f);
    acc = next;
  }
  if ((((acc & 0xff) + ((acc >> 8) & 0xff) + 0xc7) & 0xff) === 0) return; // guard clear -> image intact, done
  // Guard failed: the ROM guard table did not sum to the intact-image sentinel, so bump
  // the object-mover tamper counter (0x89e9). A nonzero tamper counter is what the rest
  // of the machine reads to freeze spawns and abort actor updates on a tampered image.
  mem8[TAMPER_STRIKES_OBJMOVE] = mem8[TAMPER_STRIKES_OBJMOVE] + 1; // tamper counter is an 8-bit cell, so the add wraps mod 256
}
