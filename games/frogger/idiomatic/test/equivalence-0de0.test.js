// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0de0 — memory-equivalent to the frozen oracle at ROM 0x0DE0.
 * GATE: crafted-entry. Attract reaches this attract board-demo assembler only through its own dwell
 * gate, so a post-boot attract clone gets the dwell counter (0x83BC) and phase counter (0x83D7) poked
 * for every branch: dwell not yet expired, the 0->0xFF wrap that keeps dwelling, each of the seven
 * cell-placement phases (cells-remain exit), and the last-cell phase that reloads the counter and
 * tail-calls the attract-idle tail 0x0E74. The routine reads its inputs from RAM (no register
 * live-in) and its live-out is memory-only, so RAM is compared and registers/SP are not. On the tail
 * path both sides run the same real 0x0E74 callee. Teeth: three broken twins.
 * NOTE: links once names.js exports loc_800f/loc_83bc/loc_83d7/loc_83bf/loc_83bb/loc_a8c6, added in
 * the naming pass.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { loc_0de0 } from "../loc_0de0.js";
import { loc_0de0 as oracle } from "../../translated/loc_0de0.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const DWELL = 0x83bc;
const PHASE = 0x83d7;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

let seed = null;
function seedMachine() {
  if (seed) return seed;
  const m = makeMachine();
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the seed run stopped early: ${m.stoppedBy}`);
  seed = m.clone();
  return seed;
}

function entry(pokes) {
  const e = seedMachine().clone();
  for (const [a, v] of Object.entries(pokes)) e.mem.write8(Number(a), v);
  return e;
}

// null == RAM-equivalent. Memory-only live-out: compare RAM, not registers or SP.
function ramDiff(cand, machine) {
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (off) => a.stateOffsetToAddr(off));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

// broken twins — one flavour per path (cells-remain path has no call; the tail path has 0x0E74).
function brokenNoOp() {}
function brokenWrongTile(m) { runBroken(m, { tile: 1 }); }
function brokenSkipTail(m) { runBroken(m, { skipTail: true }); }
function runBroken(m, { tile = 0, skipTail = false }) {
  const { mem8 } = m;
  const BASE = [0, 216, 248, 244, 244, 220, 216, 212];
  mem8[0x800d] = 3; mem8[0x800f] = 3;
  mem8[DWELL] = (mem8[DWELL] - 1) & 0xff;
  if (mem8[DWELL] !== 0) return;
  mem8[DWELL] = 32;
  const phase = mem8[PHASE];
  const src = (0xa8c6 + 96 * (phase - 1)) & 0xffff;
  const obj = (0x8040 + 4 * (7 - phase)) & 0xffff;
  const t = (BASE[phase] + tile) & 0xff;
  mem8[src] = t; mem8[(src + 1) & 0xffff] = (t + 1) & 0xff;
  mem8[(src + 32) & 0xffff] = (t + 2) & 0xff; mem8[(src + 33) & 0xffff] = (t + 3) & 0xff;
  for (let i = 0; i < 4; i++) mem8[(obj + i) & 0xffff] = 0;
  mem8[PHASE] = (mem8[PHASE] - 1) & 0xff;
  if (mem8[PHASE] !== 0) return;
  mem8[PHASE] = 7; mem8[0x83bf] = 0; mem8[0x83bb] = 0;
  if (!skipTail) m.call(0x0e74);
}

test("EQUAL (crafted): loc_0de0 == oracle on every path", { skip }, () => {
  const entries = [
    entry({ [DWELL]: 5, [PHASE]: 3 }), // dwell not yet expired
    entry({ [DWELL]: 0, [PHASE]: 4 }), // dwell 0 -> 0xFF, still dwelling
  ];
  for (let phase = 2; phase <= 7; phase++) entries.push(entry({ [DWELL]: 1, [PHASE]: phase })); // cells remain
  entries.push(entry({ [DWELL]: 1, [PHASE]: 1 })); // last cell -> reload + tail into 0x0E74
  assert.ok(entries.length > 0, "vacuous: no crafted entries");
  for (const e of entries) assert.equal(ramDiff(loc_0de0, e), null, "a crafted entry diverged");
  assert.ok(ramDiff(brokenNoOp, entry({ [DWELL]: 1, [PHASE]: 3 })), "vacuous: oracle wrote nothing on a placement path");
  console.log(`  EQUAL: ${entries.length} crafted paths, loc_0de0 == oracle`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const eRemain = entry({ [DWELL]: 1, [PHASE]: 3 }); // cells-remain path
  const eTail = entry({ [DWELL]: 1, [PHASE]: 1 }); // last-cell tail path
  assert.ok(ramDiff(brokenNoOp, eRemain), "the no-op twin escaped");
  assert.ok(ramDiff(brokenWrongTile, eRemain), "the wrong-tile twin escaped (cells-remain)");
  assert.ok(ramDiff(brokenSkipTail, eTail), "the skip-tail twin escaped");
  console.log("  TEETH: no-op, wrong-tile, skip-tail all caught");
});
