// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_22b3 — memory-equivalent to the frozen oracle at ROM 0x22b3, with both draw calls dissolved to the
 * decompiled 2x2-block primitives. Paint B marker tiles growing upward from the marker-row VRAM cell,
 * then blank the remaining of five slots. When the object-active flag is set one marker is dropped; if
 * that empties the count every slot is blanked. Whole contract is the VRAM cells (the block writers touch
 * no other live register the callers read back), so EQUAL asserts ramDiff==null across four scenarios:
 * flag-clear draws-all, flag-set drop-one, flag-set drop-to-empty (blank-all), and a full five markers.
 * Teeth: no-op, all-markers, all-blanks (the marker/blank split), and an ignore-the-drop twin.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { loc_22b3 as cand } from "../loc_22b3.js";
import { loc_22b3 as oracle } from "../../translated/loc_22b3.js";
import { drawTileBlock2x2Up } from "../drawTileBlock2x2Up.js";
import { drawFixedTileBlock2x2Up } from "../drawFixedTileBlock2x2Up.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const ROW = 0x539e;      // marker-row VRAM cell, blocks grow upward by -0x40 each
const ACTIVE = 0x4200;   // object-active flag: nonzero drops one marker
const MARKER = 102;      // marker tile seed
const BLANK = 46;        // decorative blank-slot tile seed
const SENT = 0xaa;       // pre-poked into the block cells so the writes are demonstrable

const blockCells = (dst) => [dst, (dst + 1) & 0xffff, (dst - 0x20) & 0xffff, (dst - 0x1f) & 0xffff];
const blockAt = (i) => (ROW - i * 0x40) & 0xffff;

function seedRow(mem) {
  for (let i = 0; i < 5; i++) for (const c of blockCells(blockAt(i))) mem[c] = SENT;
}

const entry = (flag, b) => craft((mem, m) => {
  m.push16(0x9999);
  m.regs.b = b;
  mem[ACTIVE] = flag;
  seedRow(mem);
});

// A hand twin: draw exactly nMarkers marker blocks, then blank out the rest of the five slots.
function drawN(m, nMarkers) {
  let dst = ROW, slot = 5;
  for (let i = 0; i < nMarkers; i++) { dst = drawTileBlock2x2Up(m, MARKER, dst).hl; slot = (slot - 1) & 0xff; }
  for (;;) { slot = (slot - 1) & 0xff; if (slot >= 128) break; dst = drawFixedTileBlock2x2Up(m, dst).hl; }
}

test("EQUAL (crafted): loc_22b3 == oracle draws/blanks the marker row (VRAM)", { skip }, () => {
  for (const [name, flag, b] of [["draw-all", 0, 3], ["drop-one", 1, 3], ["blank-all", 1, 1], ["fill-all", 0, 5]]) {
    assert.equal(ramDiff(oracle, cand, entry(flag, b)), null, `${name} path diverged on VRAM`);
  }
  // Positive control (draw-all, B=3): first three blocks are markers, last two are blanks.
  const a = entry(0, 3); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[blockAt(0)], MARKER, "control: block 0 not a marker");
  assert.equal(a.mem8[(blockAt(0) - 0x20) & 0xffff], MARKER - 2, "control: block 0 bottom pair wrong");
  assert.equal(a.mem8[blockAt(2)], MARKER, "control: block 2 (third marker) not drawn");
  assert.equal(a.mem8[blockAt(3)], BLANK, "control: block 3 not blanked");
  assert.equal(a.mem8[blockAt(4)], BLANK, "control: block 4 not blanked");
  // Positive control (blank-all): the single marker is dropped, so every slot is blanked.
  const z = entry(1, 1); z.routines = STUBS; oracle(z);
  assert.equal(z.mem8[blockAt(0)], BLANK, "control: drop-to-empty did not blank block 0");
  console.log("  EQUAL: loc_22b3 == oracle (VRAM), draw-all/drop-one/blank-all/fill-all");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const allMarkers = (m) => drawN(m, 5); // ignores the blank loop
  const allBlanks = (m) => drawN(m, 0);  // ignores the marker loop
  const ignoreDrop = (m) => drawN(m, 3); // draws B markers, never dropping one
  assert.ok(ramDiff(oracle, noOp, entry(0, 3)), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, allMarkers, entry(0, 3)), "the all-markers twin escaped");
  assert.ok(ramDiff(oracle, allBlanks, entry(0, 3)), "the all-blanks twin escaped");
  assert.ok(ramDiff(oracle, ignoreDrop, entry(1, 3)), "the ignore-the-drop twin escaped");
  console.log("  TEETH: no-op, all-markers, all-blanks, ignore-drop all caught");
});
