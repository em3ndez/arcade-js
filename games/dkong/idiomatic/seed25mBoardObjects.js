// SPDX-License-Identifier: GPL-3.0-only
/**
 * seed25mBoardObjects — build the 25m board's initial object records and their
 * sprite shadows from ROM templates.  ROM 0x0FD7.
 *
 * This is entry 1 of the per-board setup dispatch table at ROM 0x0FCD, which
 * sub_0f56 indexes by BOARD (0x6227): index 1 = 25m, 2 = 50m, 3 = 75m, 4 = 100m
 * (their setups are 0x101f/0x1087/0x1131). So this is the 25m case, and its job is
 * to stamp a handful of ROM templates into the work-RAM object records and into the
 * sprite shadow buffer (SPRITE_BUFFER 0x6900–0x6A7F, which the i8257 DMA blits to
 * sprite RAM every vblank). It runs after sub_0f56 has cleared 0x6280–0x6AFF, so it
 * is pure INITIALISATION — every byte it touches is a ROM constant, none of its
 * inputs come from prior work RAM.
 *
 * Straight-line, seven steps, no branches:
 *
 *   1. ldir 16 bytes 0x3DDC → 0x69A8  — a sprite-buffer record block.
 *   2. replicateGroupStrided (0x122A): stamp the 4-byte group at 0x3DEC into 5
 *      records at 0x6407, record stride C+4 = 0x20 (page 0x64 object records).
 *   3. loc_11fa (0x11FA): scatter the 6-byte template at 0x3DF4 into a record at
 *      0x66A0 and a 4-byte array at 0x6A28 (inside the sprite buffer).
 *   4. ldir 4 bytes 0x3E00 → 0x69FC   — another sprite-buffer record.
 *   5. seedSpriteObjectPair (0x11A6): seed the object pair at 0x6680/0x6690 from
 *      the position table at 0x3E0C and emit their two sprite records at 0x6A18.
 *   6. replicateGroupStrided (0x122A): stamp the 4-byte group at 0x101B (the DATA
 *      bytes 00 00 02 02 that sit right after this routine's `ret`) into 8 records
 *      at 0x6707, stride 0x20 (page 0x67 object records).
 *   7. replicateGroupStrided (0x122A) AGAIN with only DE and B reloaded — 2 records
 *      at 0x6807 — reusing the SAME source 0x101B and stride C=0x1C left in place by
 *      step 6. That reuse is the routine's one subtlety: replicateGroupStrided
 *      preserves HL and C for exactly this second call (documented in that routine),
 *      so step 7 does not reload them.
 *
 * Callees: replicateGroupStrided / loc_11fa / seedSpriteObjectPair — the already
 * idiomatic versions, called directly. Each reads its inputs from the register file
 * the way its Z80 ABI does, so this routine sets HL/DE/BC before each call exactly
 * as the oracle's `ld` immediates do. The two inline `ldir`s are plain block copies.
 *
 * Memory-equivalent to the frozen oracle — equivalence-0fd7.test.js.
 * GATE:     crafted-entry — real captured 25m attract dispatches (this routine runs
 *           during the attract 25m board build) + crafted footprint-prefill entries
 *           (sentinel-fill the whole 0x64/0x66/0x67/0x68/0x69/0x6A destination span
 *           so any short or mis-placed write shows) applied identically both sides.
 *           Not exhaustive: the inputs are fixed ROM constants, so a real dispatch
 *           already exercises every write. Teeth: a twin that reloads step 7's source
 *           and stride instead of reusing step 6's (breaking the HL/C-preservation
 *           reliance) — caught on the real capture and on a prefill craft.
 * LIVE-OUT: memory-only. The `ret` returns to loc_0d5f @0x0D62, a `call 0x2441`
 *           (the 25m TILE setup) that reads no register this routine leaves, so every
 *           residual register/flag is dead ABI. SP/PC are the dropped control-flow
 *           model (the JS call stack replaces the oracle's `ret`), so they are not
 *           compared; the oracle's stack pushes land only in STACK_SCRATCH.
 * NAMES:    none from ram.js — every source (0x3DDC/0x3DEC/0x3DF4/0x3E00/0x3E0C/
 *           0x101B) and destination (0x6407/0x66A0/0x6680.../0x6707/0x6807/0x69A8/
 *           0x69FC) is a ROM-hardcoded template or engine-scratch record base, kept
 *           hex, matching the callees. The sprite-buffer spans lie inside
 *           SPRITE_BUFFER (0x6900–0x6A7F), noted but not asserted per-byte.
 */

import { replicateGroupStrided } from "./replicateGroupStrided.js"; // ROM 0x122A
import { loc_11fa } from "./loc_11fa.js"; // ROM 0x11FA
import { seedSpriteObjectPair } from "./seedSpriteObjectPair.js"; // ROM 0x11A6

/** LDIR: copy `len` bytes src → dst (both 16-bit-wrapped, matching the Z80). */
function blockCopy(mem, src, dst, len) {
  for (let i = 0; i < len; i++) {
    mem.write8((dst + i) & 0xffff, mem.read8((src + i) & 0xffff));
  }
}

export function seed25mBoardObjects(m) {
  const { regs, mem } = m;

  // 1. Copy a 16-byte sprite-buffer record block (0x3DDC → 0x69A8).
  blockCopy(mem, 0x3ddc, 0x69a8, 0x10);

  // 2. Stamp the 4-byte group at 0x3DEC into 5 strided records at 0x6407 (page
  //    0x64), record size C+4 = 0x20.
  regs.hl = 0x3dec; // source group
  regs.de = 0x6407; // destination base (page 0x64, offset 0x07)
  regs.bc = 0x051c; // B = 5 records, C = 0x1C stride gap (record size 0x20)
  replicateGroupStrided(m);

  // 3. Scatter the 6-byte template at 0x3DF4 into the record at 0x66A0 and the
  //    4-byte array at 0x6A28 (loc_11fa reads HL as its source pointer).
  regs.hl = 0x3df4;
  loc_11fa(m);

  // 4. Copy a 4-byte sprite-buffer record (0x3E00 → 0x69FC).
  blockCopy(mem, 0x3e00, 0x69fc, 0x04);

  // 5. Seed the object pair at 0x6680/0x6690 from the position table at 0x3E0C and
  //    emit their two sprite records at 0x6A18 (seedSpriteObjectPair reads HL as
  //    the live-in table pointer).
  regs.hl = 0x3e0c;
  seedSpriteObjectPair(m);

  // 6. Stamp the 4-byte group at 0x101B (the DATA bytes 00 00 02 02 after this
  //    routine's `ret`) into 8 strided records at 0x6707 (page 0x67), stride 0x20.
  regs.hl = 0x101b; // source group
  regs.de = 0x6707; // destination base (page 0x67, offset 0x07)
  regs.bc = 0x081c; // B = 8 records, C = 0x1C stride gap
  replicateGroupStrided(m);

  // 7. Same group again into 2 records at 0x6807 (page 0x68). Only DE and B are set:
  //    replicateGroupStrided preserves HL (= 0x101B) and C (= 0x1C) from step 6, so
  //    the source and stride carry over — the oracle relies on that here and so do we.
  regs.de = 0x6807; // destination base (page 0x68, offset 0x07)
  regs.b = 0x02; // 2 records; HL and C unchanged from step 6
  replicateGroupStrided(m);
}
