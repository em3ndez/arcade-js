// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_24ea — the 50m moving-object subsystem tick.  ROM 0x24EA.
 *
 * Called every main-loop pass from the per-frame update cascade. Its first act is a
 * per-board skip test with the mask 0x02 (bit1 = 50m), so on any other board the whole
 * routine is skipped and nothing happens. On 50m it runs three stages in order:
 *
 *   1. service the moving-object spawn request (loc_2523);
 *   2. advance and edge-cull the six-record object row (advance50mObjectRow);
 *   3. refresh each object's hardware sprite record from the object array, so the
 *      vblank DMA blits this frame's object positions.
 *
 * The refresh walks the six records of OBJ_ARRAY_65A0 (stride 0x10) alongside the six
 * matching four-byte sprite records that begin at 0x69B8 (stride 4, inside the sprite
 * shadow buffer — the same block advance50mObjectRow blanks when it culls). For an
 * ACTIVE record (its whole activity byte nonzero) it copies four object fields into the
 * sprite record in sprite-record order:
 *
 *     sprite X    <- object X            (+3)
 *     sprite code <- object sprite code  (+7)
 *     sprite attr <- object attribute    (+8)
 *     sprite Y    <- object Y            (+5)
 *
 * An INACTIVE record (activity byte zero) is left untouched; only the sprite write
 * cursor steps past its four bytes, so that sprite slot keeps whatever the advance
 * stage last left there (a blanked record when the object was just culled). Both the
 * object cursor and the sprite cursor advance a fixed stride per record on every path,
 * so record i always pairs object 0x65A0+0x10*i with sprite 0x69B8+4*i.
 *
 * REGISTER-ABI MARSHALLING: the board test reads its applicability mask from the
 * accumulator, so the mask 0x02 is loaded exactly where the oracle's call site loads it
 * (regs.a before boardBitGate). loc_2523 and advance50mObjectRow take no register
 * inputs. advance50mObjectRow publishes the record stride 0x10 (the oracle reuses it as
 * the object-cursor increment); the idiomatic form uses the constant stride directly, so
 * that register hand-off dissolves.
 *
 * NAME: kept the neutral loc_ — this is one of the per-array sprite-record refreshers
 * (the object fields it copies are documented as feeding the sprite buffer), but its
 * confirmed English name is a job for the understanding pass, not the decompile.
 *
 * Memory-equivalent to the frozen oracle — equivalence-24ea.test.js.
 * GATE:     captured + crafted. 0x24EA is dispatched every frame, but attract only plays
 *           25m, so real captured dispatches all take the board-gate-closed skip (verified
 *           == oracle, and that they write no non-stack RAM). Crafted 50m entries (BOARD 2
 *           on a real attract base, object records + spawn/step state poked) then drive the
 *           full body: all-inactive, active field-mapping, mixed active/inactive, the
 *           whole-byte activity test, and the spawn arm (which runs the RNG). The RAM diff
 *           excludes the dead STACK_SCRATCH the oracle's push/call/ret brackets churn.
 *           Teeth: a twin that swaps the X/Y copy order and a twin that tests only bit0 of
 *           the activity byte instead of the whole byte.
 * LIVE-OUT: memory-only. The oracle's residual registers/flags and its terminal return are
 *           dead ABI — the caller resumes its per-frame cascade without reading them; the
 *           boolean board-gate return replaces the rst-0x30 stack-skip idiom.
 * NAMES:    boardBitGate (ROM 0x0030), loc_2523 (ROM 0x2523), advance50mObjectRow
 *           (ROM 0x2591) — all direct-called. OBJ_ARRAY_65A0 (0x65A0) with its shared
 *           record fields OBJ_ACTIVE/OBJ_X/OBJ_Y/OBJ_SPRITE_CODE/OBJ_SPRITE_ATTR, and the
 *           sprite-record fields SPRITE_X/SPRITE_CODE/SPRITE_ATTR/SPRITE_Y — all from
 *           ram.js. The 50m sprite block base 0x69B8 (inside SPRITE_BUFFER) has no ram.js
 *           name and stays a local hex const, matching advance50mObjectRow.
 */

import { boardBitGate } from "./boardBitGate.js";              // ROM 0x0030 (rst 0x30)
import { loc_2523 } from "./loc_2523.js";                      // ROM 0x2523
import { advance50mObjectRow } from "./advance50mObjectRow.js"; // ROM 0x2591
import {
  OBJ_ARRAY_65A0,
  OBJ_ACTIVE,
  OBJ_X,
  OBJ_Y,
  OBJ_SPRITE_CODE,
  OBJ_SPRITE_ATTR,
  SPRITE_X,
  SPRITE_CODE,
  SPRITE_ATTR,
  SPRITE_Y,
} from "./ram.js";

const BOARD_MASK_50M = 0x02; // per-board applicability mask: bit1 = 50m (this subsystem's board)
const RECORD_COUNT = 6;      // records in OBJ_ARRAY_65A0
const OBJ_STRIDE = 0x10;     // object-record stride (advance50mObjectRow publishes it; used directly here)
const SPRITE_BASE = 0x69b8;  // per-record sprite block inside SPRITE_BUFFER (unnamed in ram.js)
const SPRITE_STRIDE = 0x04;  // four-byte hardware sprite record

export function loc_24ea(m) {
  const { regs, mem } = m;

  // Stage 0 — per-board skip: only 50m runs this subsystem.
  regs.a = BOARD_MASK_50M;
  if (!boardBitGate(m)) return;

  // Stage 1 — service the moving-object spawn request.
  loc_2523(m);

  // Stage 2 — advance and edge-cull the object row.
  advance50mObjectRow(m);

  // Stage 3 — refresh each active object's sprite record from the object array.
  for (let i = 0; i < RECORD_COUNT; i++) {
    const obj = OBJ_ARRAY_65A0 + OBJ_STRIDE * i;
    const sprite = SPRITE_BASE + SPRITE_STRIDE * i;

    // Inactive record: leave its sprite slot exactly as the advance stage left it.
    if (mem.read8(obj + OBJ_ACTIVE) === 0) continue;

    // Copy the object's four display fields into the sprite record, in record order.
    mem.write8(sprite + SPRITE_X, mem.read8(obj + OBJ_X));
    mem.write8(sprite + SPRITE_CODE, mem.read8(obj + OBJ_SPRITE_CODE));
    mem.write8(sprite + SPRITE_ATTR, mem.read8(obj + OBJ_SPRITE_ATTR));
    mem.write8(sprite + SPRITE_Y, mem.read8(obj + OBJ_Y));
  }
}
