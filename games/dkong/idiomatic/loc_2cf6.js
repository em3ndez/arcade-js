// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2cf6 — preset the renderer object record's sprite fields, then fall into the
 * frame-gated string/sprite renderer.  ROM 0x2CF6.
 *
 * The setup head of the 0x2C-cluster cutscene renderer. It is entered with the renderer's
 * object-record base in the index register (the caller's RENDER_OBJ_PTR, 0x62AA — the same
 * record loc_2d15 reloads and writes) and stamps three of that record's fields with one of
 * two presets, chosen by bit 7 of the shared engine-scratch byte at 0x6382:
 *   - bit 7 CLEAR -> the default triple: sprite-code field (+0x07) = 0x15, sprite-attr
 *     field (+0x08) = 0x0B, mode field (+0x15) = 0x00.
 *   - bit 7 SET   -> the alternate triple: (+0x07) = 0x19, (+0x08) = 0x0C, (+0x15) = 0x01.
 * Then it falls straight through into loc_2d15, the frame-gated renderer tick.
 *
 * The oracle writes the default triple UNCONDITIONALLY and then, on the bit-7-set arm,
 * overwrites all three; the memory-observable result is exactly one preset per arm, so the
 * idiomatic form collapses to a single branch that writes the selected preset. (These are
 * plain work-RAM record fields, so writing a cell once versus writing-then-overwriting it
 * leaves the identical final byte.)
 *
 * The record's field offsets come from the caller (RENDER_OBJ_PTR) and have no per-field
 * ram.js name, so they stay raw offsets here — the same convention as the sibling closer
 * loc_2d8c, which stamps the same record.
 *
 * NAME: kept loc_ — the field layout and the (0x6382) bit-7 preset select are pinned to the
 * oracle, but which cutscene element the two presets animate (its game role) is not
 * corroborated to the routine-name bar. Promote once grounded, like its siblings loc_2d15 /
 * loc_2d8c.
 *
 * Memory-equivalent to the frozen oracle — equivalence-2cf6.test.js.
 * GATE:     real captured 0x2CF6 dispatches from attract (both preset arms occur naturally —
 *           12 bit-7-clear + 2 bit-7-set over 4000 frames) plus crafted entries, poked
 *           identically on both sides, that force each arm and drive the downstream renderer
 *           through its clean gate-return path and its deeper table-load path. The RAM diff
 *           excludes the dead STACK_SCRATCH the downstream loc_2d15 chain's dissolved
 *           `call 0x004e` bracket churns; pc + SP are compared after one modelled terminal
 *           return. Teeth: a twin that reads the wrong parity bit and a twin that drops the
 *           fall-through into loc_2d15.
 * LIVE-OUT: memory-only. loc_2cf6 falls into loc_2d15 whose chain nets exactly one terminal
 *           `ret`; the caller reads no register (the oracle's `rlca` residue in the
 *           accumulator is dead), so the single return is modelled in the gate, not here.
 * NAMES:    BRANCH_PARITY (0x6382) — the shared engine-scratch byte loc_2d15 / loc_2d8c read
 *           bit 0 of; this routine keys on bit 7. Kept a local hex const because it is left
 *           UNNAMED in ram.js (thin/shared engine scratch). The object-record base and its
 *           field offsets (+0x07 sprite code, +0x08 sprite attr, +0x15 mode) come from the
 *           caller and have no per-field ram.js name, so they stay raw offsets.
 */

import { loc_2d15 } from "./loc_2d15.js"; // ROM 0x2D15 — the frame-gated string/sprite renderer

const BRANCH_PARITY = 0x6382; // bit 7 selects the sprite-field preset (shared engine scratch, unnamed)

export function loc_2cf6(m) {
  const { regs, mem } = m;

  const obj = regs.ix; // renderer object-record base (the caller's RENDER_OBJ_PTR)

  // Choose the preset by bit 7 of the shared parity byte and stamp the record's sprite-code
  // (+0x07), sprite-attr (+0x08) and mode (+0x15) fields.
  if ((mem.read8(BRANCH_PARITY) & 0x80) === 0) {
    mem.write8((obj + 0x07) & 0xffff, 0x15); // sprite-code field
    mem.write8((obj + 0x08) & 0xffff, 0x0b); // sprite-attr field
    mem.write8((obj + 0x15) & 0xffff, 0x00); // mode field
  } else {
    mem.write8((obj + 0x07) & 0xffff, 0x19); // sprite-code field
    mem.write8((obj + 0x08) & 0xffff, 0x0c); // sprite-attr field
    mem.write8((obj + 0x15) & 0xffff, 0x01); // mode field
  }

  // Fall straight into the frame-gated renderer tick.
  return loc_2d15(m);
}
