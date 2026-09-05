// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_2583 — memory-equivalent to the frozen oracle at ROM 0x2583 (seeds the first tile code, then
 * dissolves its fall-through into the 2x2 tile-block writer into a direct idiomatic call). It stamps a 2x2
 * block (codes 0x2c..0x2f) at the destination (HL): top pair at HL/HL+1, bottom pair at HL+0x20/+0x21.
 * Live-outs: the four VIDEORAM writes (ramDiff) AND the advanced registers A (tile+4) and HL (dst+0x40) a
 * chaining caller reads back; DE is preserved. EQUAL asserts ramDiff==null AND regDiff over A, HL, DE.
 * Teeth: memory twins (no-op, top-row-only, no-tile-advance) and register twins (wrong A/HL, clobbered
 * DE). The return-stack window is masked by ramDiff.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { loc_2583 as cand } from "../loc_2583.js";
import { loc_2583 as oracle } from "../../translated/loc_2583.js";

const FIRST_TILE = 0x2c;    // the fixed seed code
const DE_SENTINEL = 0xbeef; // DE must survive the call unchanged
const SENTINEL = 0xaa;      // pre-poked into the four block cells so the writes are demonstrable
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

function entry(dest = 0x5100) {
  return craft((mem8, m) => {
    m.push16(0x9999);
    m.regs.hl = dest;
    m.regs.de = DE_SENTINEL;
    m.regs.a = 0x00; // overwritten by the routine's fixed seed
    for (const off of [0, 1, 0x20, 0x21]) mem8[(dest + off) & 0xffff] = SENTINEL;
  });
}

// A and HL are register live-outs (blind to ramDiff), DE must be preserved; observe them directly.
function regDiff(twin, e) {
  const a = e.clone(); a.routines = STUBS; oracle(a);
  const b = e.clone(); b.routines = STUBS; twin(b);
  if (a.regs.a !== b.regs.a) return `A: 0x${a.regs.a.toString(16)} vs 0x${b.regs.a.toString(16)}`;
  if (a.regs.hl !== b.regs.hl) return `HL: 0x${a.regs.hl.toString(16)} vs 0x${b.regs.hl.toString(16)}`;
  if (a.regs.de !== b.regs.de) return `DE: 0x${a.regs.de.toString(16)} vs 0x${b.regs.de.toString(16)}`;
  return null;
}

test("EQUAL (crafted): loc_2583 == oracle stamps the 2x2 block (RAM + A + HL + DE)", { skip }, () => {
  for (const d of [0x5100, 0x5200, 0x5040]) {
    assert.equal(ramDiff(oracle, cand, entry(d)), null, `loc_2583 RAM diverged (dest=0x${d.toString(16)})`);
    assert.equal(regDiff(cand, entry(d)), null, `loc_2583 registers diverged (dest=0x${d.toString(16)})`);
  }
  // positive control: block stamped from the fixed seed, A advanced by four, HL by 0x40, DE preserved.
  const a = entry().clone(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[0x5100], FIRST_TILE, "positive control: first tile stamped");
  assert.equal(a.mem8[0x5121], FIRST_TILE + 3, "positive control: last tile stamped");
  assert.equal(a.regs.a, (FIRST_TILE + 4) & 0xff, "positive control: A advanced by four");
  assert.equal(a.regs.hl, (0x5100 + 0x40) & 0xffff, "positive control: HL advanced by 0x40");
  assert.equal(a.regs.de, DE_SENTINEL, "positive control: DE preserved");
  console.log("  EQUAL: loc_2583 == oracle (RAM + A + HL + DE), 2x2 block stamped from the seed");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const topOnly = (m) => { m.mem8[0x5100] = FIRST_TILE; m.mem8[0x5101] = FIRST_TILE + 1; };
  const noTileAdv = (m) => {
    m.mem8[0x5100] = FIRST_TILE; m.mem8[0x5101] = FIRST_TILE + 1;
    m.mem8[0x5120] = FIRST_TILE; m.mem8[0x5121] = FIRST_TILE + 1; // should be tile+2, tile+3
  };
  const wrongA = (m) => { cand(m); m.regs.a = (m.regs.a + 1) & 0xff; };
  const wrongHL = (m) => { cand(m); m.regs.hl = (m.regs.hl + 1) & 0xffff; };
  const clobberDE = (m) => { cand(m); m.regs.de = 0x1234; };
  assert.ok(ramDiff(oracle, noOp, entry()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, topOnly, entry()), "the top-row-only twin escaped");
  assert.ok(ramDiff(oracle, noTileAdv, entry()), "the no-tile-advance twin escaped");
  assert.ok(regDiff(wrongA, entry()), "the wrong-A twin escaped (register)");
  assert.ok(regDiff(wrongHL, entry()), "the wrong-HL twin escaped (register)");
  assert.ok(regDiff(clobberDE, entry()), "the clobbered-DE twin escaped (register)");
  console.log("  TEETH: no-op, top-row-only, no-tile-advance (RAM), wrong-A/HL, clobbered-DE (registers) all caught");
});
