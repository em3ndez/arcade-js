// SPDX-License-Identifier: GPL-3.0-only
import { u16 } from "../../../core/int.js";
import { SLOT_LOOP_INDEX, COL_VAL_A, COL_SUB_A, COL_VAL_B, COL_SUB_B, PROJ_Y_LO, PROJ_Y_HI, PROJ_X_LO, PROJ_X_HI } from "./names.js";
import { emitCoordDeltaRecord } from "./emitCoordDeltaRecord.js";

/**
 * emitProjectedSlotRecord — stage one slot's projected delta into the record cells, then emit it. ROM 0xc423.
 *
 * Role in the machine: while a per-column/per-slot loop walks the projected geometry (the tube segments and
 * the objects riding them), each slot's already-computed X/Y projection lives in four parallel indexed
 * tables. This routine snapshots the current slot's four projection bytes into the delta-record work cells
 * loc_61..loc_64 and then draws the record, so the moving object appears at its projected screen position.
 *
 * Behaviour: read the loop index X from SLOT_LOOP_INDEX (loc_37), then copy that slot's cells — the Y
 * sub/value pair from COL_SUB_A/COL_VAL_A (loc_32a/loc_31a) into PROJ_Y_LO/PROJ_Y_HI (loc_61/loc_62), and
 * the X sub/value pair from COL_SUB_B/COL_VAL_B (loc_34a/loc_33a) into PROJ_X_LO/PROJ_X_HI (loc_63/loc_64).
 * Tail-delegate to emitCoordDeltaRecord to append the delta record.
 *
 * Live-out: PROJ_Y_LO/HI and PROJ_X_LO/HI (loc_61..loc_64) hold this slot's projected delta; the record and
 * its cursor advance are done by the delegate. Grounding: [seen].
 */
export function emitProjectedSlotRecord(m) {
  const { mem8 } = m;
  const x = mem8[SLOT_LOOP_INDEX];              // current slot index loc_37
  mem8[PROJ_Y_LO] = mem8[u16(COL_SUB_A + x)];   // Y sub  <- loc_32a,x
  mem8[PROJ_Y_HI] = mem8[u16(COL_VAL_A + x)];   // Y value<- loc_31a,x
  mem8[PROJ_X_LO] = mem8[u16(COL_SUB_B + x)];   // X sub  <- loc_34a,x
  mem8[PROJ_X_HI] = mem8[u16(COL_VAL_B + x)];   // X value<- loc_33a,x
  return emitCoordDeltaRecord(m);               // emit the delta record from loc_61..loc_64
}
