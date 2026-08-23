// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { tickRopeCellFrameTimer } from "./tickRopeCellFrameTimer.js";
import { loc_0020 } from "./loc_0020.js";
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
 * spawnHangingRopeObject — rope-cell state 1: spawn a bonus object and draw the segment tile.
 *
 * Runs only every fourth frame and only once this cell's timer elapses (a helper ticks it
 * and reports zero). It tentatively re-arms the timer to 1, then scans the three spawn-object
 * records for a free slot (byte0/byte1 bit0 clear); with none it leaves the timer at 1 and
 * returns. With a free slot it re-writes the timer entry with a round-scaled reload and the
 * slot index, seeds the slot (state/anim/coords, the +4 field from a fixed table keyed by IXL&3),
 * advances the cell state (ix+0), then blits the segment tile and enqueues its display command.
 *
 * LIVE-OUT: none — the rope-cell driver reads nothing back after the dispatch; IX (the cell
 * record) is only read and its register is preserved. Contract is memory only.
 */
const SLOT_STRIDE = 0x18;
const SLOT_COUNT = 3;
const ROUND_CLAMP = 0x10; // round counter clamped to this ceiling before scaling
const RELOAD_BIAS = 0x28; // subtracted from the clamped round before complement
const SPAWN_STATE = 0x07; // seeded object state byte
const ACTIVE_BIT = 0x01; // slot occupied when byte0|byte1 has this bit set

export function spawnHangingRopeObject(m, ix = m.regs.ix) {
  const { mem8 } = m;

  if ((mem8[FRAME_COUNTER] & 0x03) !== 0) return; // act on every fourth frame only

  const [timer, elapsed] = tickRopeCellFrameTimer(m, ix & 0xff); // tick this cell's timer; HL := timer cell
  if (!elapsed) return; // timer has not run out yet

  mem8[timer] = 0x01; // tentatively re-arm the cell timer

  // Find a free spawn-object slot; the counter left in `remaining` becomes the stored index.
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

  let round = mem8[ROUND_COUNTER];
  if (round >= ROUND_CLAMP) round = ROUND_CLAMP;
  const reload = ~((round - RELOAD_BIAS) & 0xff) & 0xff; // round-scaled reload
  mem8[timer] = reload;
  mem8[timer + 1] = ~remaining & 0x03; // the free slot's index (0..2)

  const [iy4] = loc_0020(m, ROPE_SPAWN_IY4_TABLE, ix & 0x03); // table lookup keyed by IXL&3
  mem8[slot + 0x00] = SPAWN_STATE;
  mem8[slot + 0x02] = 0x10;
  mem8[slot + 0x04] = iy4;
  mem8[slot + 0x05] = 0x40;
  mem8[slot + 0x06] = 0x1a;
  mem8[slot + 0x0f] = 0x2e;
  mem8[slot + 0x10] = 0x40;

  const cell = u16(ix);
  mem8[cell] = mem8[cell] + 1; // advance the cell state (ix+0); byte write wraps

  const columnBase = computeRopeCellVramColumn(m, ix & 0xff); // video-RAM column base for this rope cell
  blit2x2TileBlock(m, columnBase, ROPE_SEGMENT_TILE_SRC); // draw the segment tile
  queueSoundCommand0C(m); // enqueue the segment display command
}
