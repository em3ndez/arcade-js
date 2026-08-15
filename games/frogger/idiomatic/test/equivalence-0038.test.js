// SPDX-License-Identifier: GPL-3.0-only
/**
 * clearTilemapToTile16 — crafted-entry equivalence vs the frozen tilemap-clear primitive.
 * Seeds three VRAM cells (base, middle, last) to non-blank values, then checks both sides leave the
 * whole 32x32 map at tile 16. RAM compared, stack masked. Teeth: a no-op, a short fill leaving the
 * last cell, a wrong-tile fill; positive control the last cell really goes non-blank -> 16.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff } from "./_frogHop.js";
import { clearTilemapToTile16 as cand } from "../clearTilemapToTile16.js";
import { loc_0038 as oracle } from "../../translated/loc_0038.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const VRAM = 0xa800, LAST = 0xabff, MID = 0xaa00, FILL = 0x10;

const dirty = () => craft((mem) => { mem[VRAM] = 0x00; mem[MID] = 0x55; mem[LAST] = 0xaa; });

test("EQUAL (crafted): clearTilemapToTile16 == oracle fills the whole map", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, dirty()), null, "the fill diverged");
  const e = dirty(); const a = e.clone(); oracle(a);
  assert.equal(a.mem8[LAST], FILL, "fill not exercised: the last cell was never written");
  assert.notEqual(e.mem8[LAST], FILL, "positive control vacuous: the last cell was already blank");
  console.log(`  EQUAL: whole map filled; last cell ${e.mem8[LAST]}->${a.mem8[LAST]}`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const short = (m) => { for (let i = 0; i < 0x3ff; i++) m.mem8[(VRAM + i) & 0xffff] = FILL; }; // leaves the last cell
  const wrongTile = (m) => { for (let i = 0; i < 0x400; i++) m.mem8[(VRAM + i) & 0xffff] = 0x11; };
  assert.ok(ramDiff(oracle, noOp, dirty()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, short, dirty()), "short-fill twin escaped");
  assert.ok(ramDiff(oracle, wrongTile, dirty()), "wrong-tile twin escaped");
  console.log("  TEETH: no-op, short-fill, wrong-tile all caught");
});
