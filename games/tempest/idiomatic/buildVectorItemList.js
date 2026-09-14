// SPDX-License-Identifier: GPL-3.0-only
import { u8, u16 } from "../../../core/int.js";
import {
  DSW1_SNAPSHOT, SLOT_LOOP_INDEX, INPUT_DEBOUNCED, DSW_BONUS_CONFIG, DSW_DIFFICULTY, PLAYER_SEGMENT,
  EAROM_BLANK_FLAG, PENDING_WORK_FLAGS, EAROM_MODE,
  VEC_COORD1_LO, VEC_COORD1_HI, VEC_COORD2_LO, VEC_COORD2_HI,
  DIAG_MASK_TABLE, DIAG_VALUE_LO, DIAG_VALUE_HI,
} from "./names.js";
import { decodeOptionSwitches } from "./decodeOptionSwitches.js";
import { drawOverlayFrame } from "./drawOverlayFrame.js";
import { buildPotReadoutVectorList } from "./buildPotReadoutVectorList.js";
import { buildLargeDecimalNumber } from "./buildLargeDecimalNumber.js";
import { emitVectorHeaderWord } from "./emitVectorHeaderWord.js";
import { emitScaledCoordinateRecord } from "./emitScaledCoordinateRecord.js";
import { emitCoordinateVectorWord } from "./emitCoordinateVectorWord.js";
import { foldStepIntoFraction } from "./foldStepIntoFraction.js";
import { queueEaromRegionErase } from "./queueEaromRegionErase.js";
import { eraseEaromLowRegions } from "./eraseEaromLowRegions.js";
import { emitScaledByteDigit } from "./emitScaledByteDigit.js";

/**
 * buildVectorItemList — assemble the option/settings screen's vector item list. ROM 0xd804.
 *
 * Role in the machine: this is a trampoline target that builds one frame of the operator/options
 * display — the DIP-switch settings readout drawn with the vector generator. It runs four setup
 * passes, emits a header pair, draws a marker a DIP-configured number of times, then emits a run of
 * table-indexed coordinate records selected by the current switch settings and a couple of state
 * cells. Everything it emits lands in vector RAM for the beam to trace.
 *
 * Behavior: it decodes the option switches (decodeOptionSwitches), draws the overlay frame, builds the
 * pot readout, and builds the large decimal number. It then loads SLOT_LOOP_INDEX from DSW_BONUS_CONFIG,
 * emits the header word and a scaled coordinate record, and loops emitting a coordinate word while
 * decrementing SLOT_LOOP_INDEX until it hits zero (the marker count). Next it emits a difficulty-indexed
 * coordinate word (DSW_DIFFICULTY low two bits, doubled, into the VEC_COORD2 tables), folds PLAYER_SEGMENT
 * through foldStepIntoFraction (writing it back) and emits a segment-selected coordinate word from the
 * VEC_COORD1 tables. It then masks INPUT_DEBOUNCED with the DIAG_MASK_TABLE entry; when every mask bit is
 * present it walks the slot index down by two and either erases the low EAROM regions (setting
 * PENDING_WORK_FLAGS bits 0..1), queues a single-region erase, or — on a slot underflow — throws (the
 * original took a full RESET; the draw loop's bound keeps this unreachable in normal play). Finally, if
 * EAROM_MODE AND EAROM_BLANK_FLAG is nonzero it emits one more coordinate word, emits the second header,
 * and returns after emitting the two DSW1_SNAPSHOT-selected scaled digit records.
 *
 * Live-out: the vector item records appended to display RAM, SLOT_LOOP_INDEX, PLAYER_SEGMENT (folded),
 * and — on the mask-matched path — PENDING_WORK_FLAGS plus any EAROM erase side effects. Grounding: [seen].
 */
export function buildVectorItemList(m) {
  const { mem8 } = m;
  decodeOptionSwitches(m);          // setup pass 1: read the DIP switches
  drawOverlayFrame(m);              // setup pass 2: the overlay frame
  buildPotReadoutVectorList(m);     // setup pass 3: the pot readout
  buildLargeDecimalNumber(m);       // setup pass 4: the large decimal number

  mem8[SLOT_LOOP_INDEX] = mem8[DSW_BONUS_CONFIG];   // marker repeat count from the bonus DIP
  emitVectorHeaderWord(m);
  emitScaledCoordinateRecord(m, 0xe8, 0xc0);
  do {                                              // emit the marker SLOT_LOOP_INDEX times
    emitCoordinateVectorWord(m, 0x32, 0x6c);
    mem8[SLOT_LOOP_INDEX] = u8(mem8[SLOT_LOOP_INDEX] - 1);
  } while (mem8[SLOT_LOOP_INDEX] !== 0);

  const y = (mem8[DSW_DIFFICULTY] & 0x03) << 1;     // difficulty (0..3) doubled into a table index
  emitCoordinateVectorWord(m, mem8[u16(VEC_COORD2_HI + y)], mem8[u16(VEC_COORD2_LO + y)]);

  const folded = foldStepIntoFraction(m, mem8[PLAYER_SEGMENT]);
  mem8[PLAYER_SEGMENT] = folded;                    // write the folded segment back
  const sel = folded & 0x06;                        // segment-selected table index
  emitCoordinateVectorWord(m, mem8[u16(VEC_COORD1_HI + sel)], mem8[u16(VEC_COORD1_LO + sel)]);

  let x = sel >> 1;
  const mask = mem8[u16(DIAG_MASK_TABLE + x)];
  const anded = mem8[INPUT_DEBOUNCED] & mask;      // AND then CMP the mask-table entry
  if (anded === mask) {                    // every mask bit present in the status cell
    x = u8(x - 2);
    if ((x & 0x80) === 0) {                // x-2 stayed non-negative
      if (x !== 0) {
        eraseEaromLowRegions(m);
        mem8[PENDING_WORK_FLAGS] = mem8[PENDING_WORK_FLAGS] | 0x03; // arm the erase work bits
      } else {
        queueEaromRegionErase(m);                       // clv/bvc merge into the common tail
      }
    } else {
      // Slot-index underflow: the original takes a full RESET here. This is an error arm the draw loop's
      // bound keeps unreachable in normal play; if it ever trips it signals a genuine invariant break.
      throw new Error("buildVectorItemList: draw slot-index underflow — a full RESET, unreachable in normal play");
    }
  }

  // Extra coordinate word only when the EAROM mode/blank flags agree.
  if ((mem8[EAROM_MODE] & mem8[EAROM_BLANK_FLAG]) !== 0) {
    emitCoordinateVectorWord(m, 0x34, 0x6e);
  }
  emitVectorHeaderWord(m);                          // second header word

  const lo = (mem8[DSW1_SNAPSHOT] & 0x1c) >> 2;     // DSW1 bits 2..4 select the low digit
  emitScaledByteDigit(m, mem8[u16(DIAG_VALUE_LO + lo)], 0xee, 0x1b);

  const hi = mem8[DSW1_SNAPSHOT] >> 5;              // DSW1 top three bits select the high digit
  return emitScaledByteDigit(m, mem8[u16(DIAG_VALUE_HI + hi)], 0x32, 0xf8);
}
