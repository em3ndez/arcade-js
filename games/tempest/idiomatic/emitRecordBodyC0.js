// SPDX-License-Identifier: GPL-3.0-only
import { emitRecordBodyByte } from "./emitHeaderedBodyRecord.js";

/**
 * emitRecordBodyC0 — append a display-list record whose body byte is the fixed 0xc0. ROM 0xdf09.
 *
 * Role in the machine: Tempest builds each frame's picture as a stream of vector-generator records
 * written through the draw cursor loc_74. Several callers want a record whose leading body byte is the
 * constant 0xc0 (a specific VG opcode/attribute for that record class); rather than repeat the store-and-
 * tail dance, they call here. This is the single-purpose entry that pins that constant.
 *
 * Behavior: forwards to the shared emitter emitRecordBodyByte with the literal 0xc0 — that helper stores
 * the byte at the cursor origin (loc_74)+0 and falls into the common record-tail path (0xdfac) which
 * writes the remaining slots and advances / wraps the cursor.
 *
 * Live-out: whatever the shared record tail leaves — the byte at the draw cursor origin and the advanced
 * draw cursor loc_74. Grounding: [seen].
 */
export function emitRecordBodyC0(m) {
  // Delegate to the shared record emitter with the fixed body byte 0xc0.
  return emitRecordBodyByte(m, 0xc0);
}
