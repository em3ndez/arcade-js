// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  ATTRACT_FIELD_ATTRIB_SRC,
  ROM_BLOCK_CHECKSUM_TABLE,
  PLAYFIELD_CHECKSUM_VRAM_BASE,
  ENEMY_ACTOR_TABLE,
  ATTRACT_SUBSTATE,
} from "./names.js";
import { fillByteRun } from "./fillByteRun.js";
import { tickCounterAndMirrorIfFlipped } from "./tickCounterAndMirrorIfFlipped.js";
import { clearAndReseedObjectSlot } from "./clearAndReseedObjectSlot.js";
/**
 * advanceAttractStateIfImageIntact — periodic self-integrity check dispatched over an actor slot.
 *
 * WHAT IT IS
 *   A guard that fires on a fixed cadence while the machine idles in attract/demo mode. It only
 *   lets the attract sequence take its next step after proving two things are unchanged since the
 *   game was manufactured: the program image in ROM, and the fixed picture currently painted on
 *   screen. This is one strand of the board's anti-tamper lattice — the code path it takes on a
 *   corrupt image is one that never happens on a genuine, untouched machine.
 *
 * ROLE IN THE MACHINE
 *   The attract loop hands this routine an actor record and calls it every frame. Each record
 *   carries its own down-counter, so the expensive checksum work runs only once every FRAME_DELAY
 *   frames rather than every frame. On a clean image it opens the gate to the next attract phase
 *   (bumping ATTRACT_SUBSTATE) and freshens the enemy arena so the demo can proceed; on a corrupt
 *   image it diverts, and the attract sequence never advances.
 *
 * ROM ADDRESS: 0x7881 (range 0x7881-0x78ff).
 * Grounding: [seen].
 *
 * LIVE-OUT: none — a void integrity pass. On a clean image its side effects are ATTRACT_SUBSTATE
 *   (0x8e51) := 2, a zeroed enemy-actor arena + trailing block, and a re-seeded actor slot; on a
 *   corrupt image it leaves the machine wherever the divert routine leaves it. The caller reads
 *   nothing back from the return value.
 */
const BLOCKS = 0x09; //       nine 32-byte program-image blocks are summed in turn
const BLOCK_BYTES = 0x20; //  32 bytes make up one block
const COL_CELLS = 0x0c; //    twelve tile cells are summed per playfield column
const ROW = 0x20; //          one tile row spans 0x20 cells, so +/-0x20 walks a column vertically
const SENTINEL_BIAS = 0xa6; // folding constant: a clean playfield's two summed bytes + 0xa6 == 0 (mod 256)
const TRAILING_CLEAR = 0x37; // 0x37 bytes are cleared just past the enemy-actor arena
const FRAME_DELAY = 0x11; //  offset into the actor record of its per-slot frame countdown

export function advanceAttractStateIfImageIntact(m, record = m.regs.ix) {
  const { mem8 } = m;

  // --- Cadence gate (ROM 0x7881-0x7884) --------------------------------------------------------
  // Each actor record keeps a private countdown at offset FRAME_DELAY (record + 0x11). Tick it
  // down by one every call; the integrity work below runs only on the single frame the counter
  // reaches zero. Every other frame we return immediately, so the heavy ROM/playfield scans cost
  // one frame in FRAME_DELAY rather than one per frame.
  mem8[record + FRAME_DELAY] = u8(mem8[record + FRAME_DELAY] - 1);
  if (mem8[record + FRAME_DELAY] !== 0) return; // act only on the frame the countdown expires

  // --- Check 1: program-image integrity (ROM 0x7885-0x78b5) ------------------------------------
  // Walk BLOCKS (9) consecutive 32-byte blocks of the program image starting at
  // ATTRACT_FIELD_ATTRIB_SRC (0x0779), keeping one running 16-bit total across all of them. After
  // each block the *cumulative* total so far must equal the matching word in
  // ROM_BLOCK_CHECKSUM_TABLE (0x7900), a table of nine little-endian expected running totals baked
  // into ROM. Any single byte altered anywhere in the region shifts every total from that point on,
  // so the first block whose cumulative total disagrees aborts the whole pass — the attract state
  // is left un-advanced and control returns to the caller.
  let table = ROM_BLOCK_CHECKSUM_TABLE;
  let src = ATTRACT_FIELD_ATTRIB_SRC;
  let romSum = 0;
  for (let block = 0; block < BLOCKS; block++) {
    for (let i = 0; i < BLOCK_BYTES; i++) {
      // accumulate one byte into the wrapping 16-bit total
      romSum = u16(romSum + mem8[src]);
      src = u16(src + 1);
    }
    // Compare the cumulative total against this block's expected word (low byte, then high byte).
    if (mem8[table] !== (romSum & 0xff) || mem8[table + 1] !== (romSum >> 8)) return; // drifted -> abort
    // advance to the next expected-total word
    table = u16(table + 2);
  }

  // --- Latch the next attract phase (ROM 0x78b7-0x78bc) ----------------------------------------
  // The ROM image passed. Set the attract-mode sub-state selector ATTRACT_SUBSTATE (0x8e51) to 2;
  // the attract dispatcher indexes its phase-handler table by this value, so writing 2 arms the
  // next phase of the demo. This happens before the playfield check below, matching the ROM order.
  mem8[ATTRACT_SUBSTATE] = 0x02;

  // --- Check 2: playfield-image integrity (ROM 0x78bc-0x78ec) ----------------------------------
  // Fold the fixed attract picture down to a single checksum by walking a serpentine path through
  // video RAM: two adjacent columns, one summed top-to-bottom and its neighbour bottom-to-top.
  // Starting at PLAYFIELD_CHECKSUM_VRAM_BASE (0x8548), sum COL_CELLS (12) cells stepping down one
  // tile row (+ROW = +0x20) at a time, giving a wrapping 16-bit total.
  let fieldSum = 0;
  let cell = PLAYFIELD_CHECKSUM_VRAM_BASE;
  for (let i = 0; i < COL_CELLS; i++) {
    fieldSum = u16(fieldSum + mem8[cell]);
    cell = u16(cell + ROW);
  }
  // Step one cell sideways into the neighbouring column, then sum its 12 cells walking back up
  // (-ROW = -0x20) into the same running total. The down-then-up traversal is why it is serpentine.
  cell = u16(cell + 1); // cross to the adjacent column
  for (let i = 0; i < COL_CELLS; i++) {
    fieldSum = u16(fieldSum + mem8[cell]);
    cell = u16(cell - ROW);
  }
  // Fold the 16-bit total: add its two bytes together with the sentinel constant SENTINEL_BIAS
  // (0xa6). The expected picture was authored so this fold lands at zero (mod 256); any nonzero
  // result means the on-screen image has been altered, so hand off to tickCounterAndMirrorIfFlipped
  // — the divert taken only on a bad image, from which the attract phase does not proceed normally.
  if ((((fieldSum & 0xff) + (fieldSum >> 8) + SENTINEL_BIAS) & 0xff) !== 0) return tickCounterAndMirrorIfFlipped(m, fieldSum); // bad image

  // --- Clean image: freshen the enemy arena and re-seed the slot (ROM 0x78f3-0x78ff) -----------
  // Both images verified. Wipe the enemy-actor world so the next attract phase starts from a blank
  // slate: zero the full ENEMY_ACTOR_TABLE arena (0x8ae0) — a zero count fills a whole 256-byte
  // page — and fillByteRun returns the pointer just past it, from which we clear TRAILING_CLEAR
  // (0x37) more bytes. Finally re-seed the actor slot for this record behind its own colour-RAM
  // integrity guard, priming it for the phase just armed.
  const trailing = fillByteRun(m, ENEMY_ACTOR_TABLE, 0x00, 0x00); // clear the arena (a zero count fills 256)
  fillByteRun(m, trailing, 0x00, TRAILING_CLEAR); // clear the trailing block
  clearAndReseedObjectSlot(m, record); // re-seed the actor slot
}
