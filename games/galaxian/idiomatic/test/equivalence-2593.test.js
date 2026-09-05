// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2593 — crafted-entry equivalence vs the frozen upward 2x2 tile-block writer at ROM 0x2593, with
 * its stamp calls dissolved to the decompiled tile-pair primitive. It writes a top pair (tile, tile+1)
 * at HL, then a bottom pair (tile-2, tile-1) one tilemap row above, stepping the tile code back four
 * between the pairs. Live-outs are the four VRAM cells (ramDiff) AND the advanced registers A (net back
 * to the seed tile) and HL (dst - 0x40) a chaining caller reads on; DE is preserved. So EQUAL asserts
 * ramDiff==null AND regDiff over A/HL/DE. Teeth: memory twins (no-op, top-only, no-step-back) and
 * register twins (wrong A, wrong HL, clobbered DE). The return-stack window is masked by ramDiff.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { loc_2593 as cand } from "../loc_2593.js";
import { loc_2593 as oracle } from "../../translated/loc_2593.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const DEST = 0x5140;       // VIDEO RAM, upper pair (DEST-0x20) still inside 0x5000-0x53ff
const TILE = 0x2c;
const DE_SENTINEL = 0xbeef; // DE must survive the call unchanged
const SENTINEL = 0xaa;      // pre-poked into the four block cells so the writes are demonstrable

// A crafted entry with A=tile, HL=dest, DE=sentinel, the four block cells pre-dirtied, and the caller
// return address on the stack (the tail's final ret consumes it).
function entry(tile = TILE, dest = DEST) {
  return craft((mem8, m) => {
    m.push16(0x9999);
    m.regs.a = tile;
    m.regs.hl = dest;
    m.regs.de = DE_SENTINEL;
    for (const off of [0, 1, -0x20, -0x1f]) mem8[(dest + off) & 0xffff] = SENTINEL;
  });
}

// A, HL, DE are register live-outs (blind to ramDiff); observe them directly.
function regDiff(twin, e) {
  const a = e.clone(); a.routines = STUBS; oracle(a);
  const b = e.clone(); b.routines = STUBS; twin(b);
  if (a.regs.a !== b.regs.a) return `A: 0x${a.regs.a.toString(16)} vs 0x${b.regs.a.toString(16)}`;
  if (a.regs.hl !== b.regs.hl) return `HL: 0x${a.regs.hl.toString(16)} vs 0x${b.regs.hl.toString(16)}`;
  if (a.regs.de !== b.regs.de) return `DE: 0x${a.regs.de.toString(16)} vs 0x${b.regs.de.toString(16)}`;
  return null;
}

test("EQUAL: loc_2593 == oracle stamps the upward 2x2 block (RAM + A + HL + DE)", { skip }, () => {
  const cases = [[0x2c, 0x5140], [0x00, 0x5240], [0xfe, 0x5180]]; // tile 0x00 wraps the step-back, 0xfe wraps the top
  for (const [t, d] of cases) {
    assert.equal(ramDiff(oracle, cand, entry(t, d)), null,
      `loc_2593 RAM diverged (tile=0x${t.toString(16)} dest=0x${d.toString(16)})`);
    assert.equal(regDiff(cand, entry(t, d)), null, `loc_2593 registers diverged (tile=0x${t.toString(16)})`);
  }
  // positive control: sentinels overwritten, A returns to the seed tile, DE preserved, HL back by 0x40.
  const a = entry().clone(); a.routines = STUBS; oracle(a);
  assert.notEqual(a.mem8[DEST], SENTINEL, "control: oracle stamped the top pair");
  assert.notEqual(a.mem8[(DEST - 0x20) & 0xffff], SENTINEL, "control: oracle stamped the upper pair");
  assert.equal(a.regs.a, TILE, "control: A stepped +2,-4,+2 back to the seed tile");
  assert.equal(a.regs.de, DE_SENTINEL, "control: oracle preserved DE");
  assert.equal(a.regs.hl, (DEST - 0x40) & 0xffff, "control: HL advanced two rows up");
  console.log("  EQUAL: loc_2593 == oracle (RAM + A + HL + DE), upward 2x2 block stamped");
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
