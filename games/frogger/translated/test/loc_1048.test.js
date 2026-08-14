// SPDX-License-Identifier: GPL-3.0-only
//
// Drafter + mutation test for loc_1048 (Frogger boot busy-delay, ROM 0x1048-0x1057).
// BC=0xEFFF->0, watchdog read 0xEFFF times, 2,399,976 T (ld bc 10 + ret 10 +
// 61183@39T + 255@54T + 1@49T). Writes NO memory -> only the cycle+read count catches a timing bug.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_1048 } from "../loc_1048.js";

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  return m;
}

function checkSpec(res) {
  assert.equal(res.cycles, 2399976, "T-state total of the BC=0xEFFF busy-delay");
  assert.equal(res.wd, 0xefff, "watchdog read once per pass (0xEFFF passes)");
  assert.equal(res.bc, 0, "BC counted down to 0");
}

test("loc_1048: watchdog-fed busy-delay, BC 0xEFFF->0, 2,399,976 T", () => {
  const m = mk();
  loc_1048(m);
  checkSpec({ cycles: m.cycles, wd: m.mem.watchdogReads, bc: m.regs.bc });
});

// MUTATION-PATCH  file: games/frogger/translated/loc_1048.js
//   find: m.step(0x104e, 13); // ld a,(0x8800) -- pet the watchdog
//   repl: m.step(0x104e, 12); // ld a,(0x8800) -- pet the watchdog
//   expect: FAIL  (undercharges the watchdog read 1T x0xEFFF; no memory moves)
//   verified-anchor: count == 1
test("loc_1048: the cycle assertion catches an undercharged instruction", () => {
  const m = mk();
  const os = m.step.bind(m);
  m.step = (a, t) => os(a, a === 0x104e && t === 13 ? 12 : t);
  loc_1048(m);
  assert.throws(
    () => checkSpec({ cycles: m.cycles, wd: m.mem.watchdogReads, bc: m.regs.bc }),
    /T-state total/,
  );
});
