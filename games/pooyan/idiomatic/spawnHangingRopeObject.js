// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { tickRopeCellFrameTimer } from "./tickRopeCellFrameTimer.js";
import { fetchByteFromTableIndex } from "./fetchByteFromTableIndex.js";
import { computeRopeCellVramColumn } from "./computeRopeCellVramColumn.js";
import { blit2x2TileBlock } from "./blit2x2TileBlock.js";
import { queueSoundCommand0C } from "./queueSoundCommand0C.js";
import {
  FRAME_COUNTER,
  ROUND_COUNTER,
  SPAWN_OBJECT_TABLE,
  ROPE_SPAWN_IY4_TABLE,
  ROPE_SEGMENT_TILE_SRC,
} from "./names.js";
/**
 * spawnHangingRopeObject — rope-cell state 1: the "birth" step for a hanging bonus object.
 *
 * WHAT IT IS
 *   The rope in Pooyan grows downward as a vertical column of segments, and grabbable bonus
 *   objects ride those segments down toward the player. Each live rope cell runs a tiny state
 *   machine; this is the handler for a cell whose state byte is 1. Its job on the frame it fires
 *   is to hang a new bonus object off this segment: it reserves one entry in the shared
 *   spawn-object table, paints the segment's tile, and then hands the cell on to the states that
 *   carry the object downward.
 *
 * ROLE IN THE MACHINE
 *   The rope-cell driver walks the per-cell state array and dispatches each active cell by its
 *   state byte; a cell in state 1 lands here. IX points at this cell's record, and the low two
 *   bits of that pointer (IXL & 3) name which of the four rope cells we are — those bits pick the
 *   cell's frame timer, its per-cell seed value, and its video column throughout the routine.
 *
 * ROM ADDRESS   0x2e5e  (range 0x2e5e-0x2ec6)
 * GROUNDING     [seen]
 *
 * LIVE-OUT: none is returned — the caller reads nothing back after the dispatch, and IX (the cell
 *   record pointer) is only read, never handed back changed. The whole contract is memory:
 *     - the cell's frame-timer bank entry is rewritten (a round-scaled reload, plus the reserved
 *       slot index in the byte that follows it),
 *     - one previously free slot in SPAWN_OBJECT_TABLE is seeded into a live bonus object,
 *     - the cell's own state byte (ix+0) is bumped to its next state,
 *     - the segment's 2x2 tile is drawn into video RAM, and
 *     - a sound command is queued.
 */
const SLOT_STRIDE = 0x18; // byte stride between the three spawn-object records
const SLOT_COUNT = 3;     // the spawn-object table holds three slots
const ROUND_CLAMP = 0x10; // round counter clamped to this ceiling before scaling
const RELOAD_BIAS = 0x28; // subtracted from the clamped round before complement
const SPAWN_STATE = 0x07; // seeded object state byte
const ACTIVE_BIT = 0x01; // slot occupied when byte0|byte1 has this bit set

export function spawnHangingRopeObject(m, ix = m.regs.ix) {
  const { mem8 } = m;

  // FRAME GATE. FRAME_COUNTER (0x8a5f) is the free-running vblank down-counter; its low two bits
  // phase the game's animation. Gating on those two bits being zero throttles this whole handler
  // to once every four frames, spacing out how often a cell may hang a new object.
  if ((mem8[FRAME_COUNTER] & 0x03) !== 0) return; // act on every fourth frame only

  // PER-CELL TIMER. Each of the four rope cells owns a frame timer; this decrements the one named
  // by IXL & 3 and reports whether it just reached zero, leaving the timer's address for reuse.
  // Until a cell's own timer elapses there is nothing to do this frame.
  const [timer, elapsed] = tickRopeCellFrameTimer(m, ix & 0xff); // tick this cell's timer; HL := timer cell
  if (!elapsed) return; // timer has not run out yet

  // Provisionally re-arm the timer to 1 so that, if the spawn attempt below fails for want of a
  // free slot, the cell will retry almost immediately rather than idling for a full reload.
  mem8[timer] = 0x01; // tentatively re-arm the cell timer

  // FIND A FREE SPAWN SLOT. SPAWN_OBJECT_TABLE (0x8c48) is the base of the three-slot bonus-object
  // table (records 0x18 bytes apart). A slot counts as free when bit0 of (byte0 | byte1) is clear
  // — bit0 is the occupancy bit set by a live object. Walk up to three records; the loop counter
  // left in `remaining` at the free record encodes which slot it is (turned into 0..2 below).
  let slot = SPAWN_OBJECT_TABLE;
  let remaining = SLOT_COUNT;
  let found = false;
  for (;;) {
    if (((mem8[slot] | mem8[slot + 1]) & ACTIVE_BIT) === 0) { found = true; break; }
    slot = u16(slot + SLOT_STRIDE);
    remaining = (remaining - 1) & 0xff;
    if (remaining === 0) break;
  }
  if (!found) return; // no free slot; the timer keeps its re-armed value of 1

  // ROUND-SCALED RELOAD. Read ROUND_COUNTER (0x8907), clamp it to ROUND_CLAMP (0x10), subtract
  // RELOAD_BIAS (0x28) and complement. As the round climbs toward the clamp the reload shrinks, so
  // later, harder rounds hang their next object sooner — a difficulty ramp on spawn cadence.
  let round = mem8[ROUND_COUNTER];
  if (round >= ROUND_CLAMP) round = ROUND_CLAMP;
  const reload = ~((round - RELOAD_BIAS) & 0xff) & 0xff; // round-scaled reload
  mem8[timer] = reload;
  // Record the reserved slot's index (0..2) in the byte just after the timer, so the later carry-
  // down states know which spawn-object record this cell owns.
  mem8[timer + 1] = ~remaining & 0x03; // the free slot's index (0..2)

  // SEED THE OBJECT. Pull this cell's +4 field value from ROPE_SPAWN_IY4_TABLE (0x2ec7), indexed
  // by the cell number (IXL & 3), then stamp the free slot with a fresh hanging object: the active
  // state byte (0x07, which is what marks the slot occupied), a fixed animation/coordinate seed,
  // and that per-cell +4 field. This is the object's initial on-rope pose.
  const [iy4] = fetchByteFromTableIndex(m, ROPE_SPAWN_IY4_TABLE, ix & 0x03); // table lookup keyed by IXL&3
  mem8[slot + 0x00] = SPAWN_STATE;   // object state byte -> active (sets the occupancy bit)
  mem8[slot + 0x02] = 0x10;          // fixed seed field
  mem8[slot + 0x04] = iy4;           // per-cell +4 field from ROPE_SPAWN_IY4_TABLE
  mem8[slot + 0x05] = 0x40;          // fixed seed field
  mem8[slot + 0x06] = 0x1a;          // fixed seed field
  mem8[slot + 0x0f] = 0x2e;          // fixed seed field
  mem8[slot + 0x10] = 0x40;          // fixed seed field

  // ADVANCE THE CELL. Bump this cell's own state byte (ix+0) from 1 to its next value so that on
  // following frames the carry-down handlers take over and walk the freshly hung object downward.
  const cell = u16(ix);
  mem8[cell] = mem8[cell] + 1; // advance the cell state (ix+0); byte write wraps

  // DRAW AND ANNOUNCE. Resolve this cell's page-0x84 video-RAM column base (from the rope-cell
  // column table, again keyed by IXL & 3), copy the 4-byte 2x2 rope-segment tile source
  // (ROPE_SEGMENT_TILE_SRC, 0x2dfe) into that square, and queue the fixed sound command for the
  // new segment.
  const columnBase = computeRopeCellVramColumn(m, ix & 0xff); // video-RAM column base for this rope cell
  blit2x2TileBlock(m, columnBase, ROPE_SEGMENT_TILE_SRC); // draw the segment tile
  queueSoundCommand0C(m); // enqueue the segment's fixed sound command
}
