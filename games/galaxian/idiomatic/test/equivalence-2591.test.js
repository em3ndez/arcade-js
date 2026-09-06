// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2591 — crafted-entry equivalence vs the frozen entry at ROM 0x2591, which forces the fixed tile
 * seed and falls into the upward 2x2 tile-block writer (dissolved to the decompiled block primitive). It
 * writes a top pair (0x2e, 0x2f) at HL and a bottom pair (0x2c, 0x2d) one tilemap row above. Live-outs
 * are the four VRAM cells (ramDiff) AND registers A (net back to the forced seed 0x2e), HL (dst - 0x40)
 * and DE (preserved). EQUAL asserts ramDiff==null AND regDiff over A/HL/DE; the seed pokes A foreign to
 * prove loc_2591 forces the tile. Teeth: RAM twins (no-op, top-only, no-step-back) and register twins
 * (wrong A, wrong HL, clobbered DE). The return-stack window is masked by ramDiff.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { drawFixedTileBlock2x2Up as cand } from "../drawFixedTileBlock2x2Up.js";
import { loc_2591 as oracle } from "../../translated/loc_2591.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const DEST = 0x5140;        // VIDEO RAM; the upper pair (DEST-0x20) stays inside 0x5000-0x53ff
const TILE = 0x2e;          // the seed loc_2591 forces regardless of the incoming A
const FOREIGN_A = 0x99;     // poked into A to prove loc_2591 overrides it
const DE_SENTINEL = 0xbeef; // DE must survive the call unchanged
const SENTINEL = 0xaa;      // pre-poked into the four block cells so the writes are demonstrable

// A crafted entry with A foreign, HL=dest, DE=sentinel, the four block cells pre-dirtied, and the caller
// return address on the stack (the tail's final ret consumes it).
const entry = () => craft((mem, m) => {
  m.push16(0x9999);
  m.regs.a = FOREIGN_A;
  m.regs.hl = DEST;
  m.regs.de = DE_SENTINEL;
  for (const off of [0, 1, -0x20, -0x1f]) mem[(DEST + off) & 0xffff] = SENTINEL;
});

// A, HL, DE are register live-outs (blind to ramDiff); observe them directly.
function regDiff(twin, e) {
  const a = e.clone(); a.routines = STUBS; oracle(a);
  const b = e.clone(); b.routines = STUBS; twin(b);
  if (a.regs.a !== b.regs.a) return `A: 0x${a.regs.a.toString(16)} vs 0x${b.regs.a.toString(16)}`;
  if (a.regs.hl !== b.regs.hl) return `HL: 0x${a.regs.hl.toString(16)} vs 0x${b.regs.hl.toString(16)}`;
  if (a.regs.de !== b.regs.de) return `DE: 0x${a.regs.de.toString(16)} vs 0x${b.regs.de.toString(16)}`;
  return null;
}

test("EQUAL (crafted): loc_2591 == oracle stamps the seeded upward 2x2 block (RAM + A + HL + DE)", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, entry()), null, "loc_2591 RAM diverged");
  assert.equal(regDiff(cand, entry()), null, "loc_2591 registers diverged");
  const a = entry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[DEST], TILE, "control: top pair stamped (tile)");
  assert.equal(a.mem8[DEST + 1], (TILE + 1) & 0xff, "control: top pair stamped (tile+1)");
  assert.equal(a.mem8[(DEST - 0x20) & 0xffff], (TILE - 2) & 0xff, "control: bottom pair stamped (tile-2)");
  assert.equal(a.mem8[(DEST - 0x1f) & 0xffff], (TILE - 1) & 0xff, "control: bottom pair stamped (tile-1)");
  assert.equal(a.regs.a, TILE, "control: A forced to the seed and stepped back to it");
  assert.equal(a.regs.hl, (DEST - 0x40) & 0xffff, "control: HL advanced two rows up");
  assert.equal(a.regs.de, DE_SENTINEL, "control: DE preserved");
  console.log("  EQUAL: loc_2591 == oracle (RAM + A + HL + DE), forced-seed upward 2x2 block stamped");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const topOnly = (m) => { m.mem8[DEST] = TILE; m.mem8[DEST + 1] = TILE + 1; }; // upper pair missing
  const noStepBack = (m) => {
    m.mem8[DEST] = TILE; m.mem8[DEST + 1] = TILE + 1;
    m.mem8[(DEST - 0x20) & 0xffff] = (TILE + 2) & 0xff; // should be tile-2, tile-1
    m.mem8[(DEST - 0x1f) & 0xffff] = (TILE + 3) & 0xff;
  };
  const wrongA = (m) => { cand(m); m.regs.a = (m.regs.a + 1) & 0xff; };
  const wrongHL = (m) => { cand(m); m.regs.hl = (m.regs.hl + 1) & 0xffff; };
  const clobberDE = (m) => { cand(m); m.regs.de = 0x1234; };

  assert.ok(ramDiff(oracle, noOp, entry()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, topOnly, entry()), "the top-only twin escaped");
  assert.ok(ramDiff(oracle, noStepBack, entry()), "the no-step-back twin escaped");
  assert.ok(regDiff(wrongA, entry()), "the wrong-A twin escaped (register)");
  assert.ok(regDiff(wrongHL, entry()), "the wrong-HL twin escaped (register)");
  assert.ok(regDiff(clobberDE, entry()), "the clobbered-DE twin escaped (register)");
  console.log("  TEETH: no-op, top-only, no-step-back (RAM), wrong-A, wrong-HL, clobbered-DE (registers) all caught");
});
