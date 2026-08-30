// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
/**
 * seedObjectRecord — populate one game-object record from two parallel setup streams.
 *
 * ROM 0x0a0c-0x0a24. Grounding: [seen].
 *
 * The machine keeps its moving things — the enemies, the arrows, the prizes — as fixed-layout
 * records in RAM. When a board is laid out, a build loop marches down a table of objects and
 * calls this leaf once per object to fill in that object's record from two data tables it reads
 * in lockstep: a DESCRIPTOR stream (what the object is / how it behaves) and a COORDINATE stream
 * (where it starts). Two bytes are consumed from each stream per object.
 *
 * The record base is handed in (the caller advances it itself between objects); the two stream
 * pointers are handed in and this routine advances them, so the caller's loop reads the next
 * object's data on the following pass.
 *
 * The five stores below are exactly the ROM's, at the same record offsets:
 *   - descriptor byte 0 -> record+0x06, descriptor byte 1 -> record+0x04 (note the fields are
 *     filled in the ROM's order, 0x06 before 0x04, from consecutive descriptor bytes);
 *   - coordinate byte 0 -> record+0x0c, coordinate byte 1 -> record+0x0d (the two coordinate
 *     bytes land in adjacent record fields, low byte first as the stream stores them);
 *   - record+0x0e cleared to 0 — the object's per-record timer, zeroed so it starts fresh.
 *
 * A pure leaf: it reads only its two streams and writes only this one record; it calls nothing.
 *
 * LIVE-OUT: [descPtr, coordPtr] — both source pointers advanced by 2. The caller's build loop
 * consumes them (it checks the descriptor stream for its end sentinel and reads the next
 * coordinate from there), so both advanced pointers are written back for the caller: DE gets
 * descPtr, HL gets coordPtr. The record base is left as it was — the caller steps that itself.
 */
export function seedObjectRecord(m, record = m.regs.ix, descPtr = m.regs.de, coordPtr = m.regs.hl) {
  const { mem8 } = m;

  // Descriptor stream (2 bytes): the two "what/how" bytes land at record+0x06 then record+0x04,
  // in that ROM order, straight from the two consecutive descriptor bytes.
  mem8[record + 0x06] = mem8[descPtr];
  mem8[record + 0x04] = mem8[descPtr + 0x01];

  // Coordinate stream (2 bytes): the starting position, low byte first, into the record's two
  // adjacent coordinate fields at record+0x0c and record+0x0d.
  mem8[record + 0x0c] = mem8[coordPtr];
  mem8[record + 0x0d] = mem8[coordPtr + 0x01];

  // Clear the object's per-record timer at record+0x0e so this freshly-seeded object starts
  // its life with a zero countdown.
  mem8[record + 0x0e] = 0x00;

  // Advance both stream pointers past the two bytes each just consumed and hand them back so the
  // caller's loop reads the next object on its following pass.
  return [m.regs.de = u16(descPtr + 0x02), m.regs.hl = u16(coordPtr + 0x02)];
}
