// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_1a02 (Frogger object-animation state init, ROM 0x1A02-0x1A54). PURE LEAF:
// seeds the lane-anim cells at 0x8021-0x803b and the 0x800d..0x801f block, then ret.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_1a02 } from "../loc_1a02.js";

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  return m;
}
const r = (m, a) => m.mem.workRam[a - 0x8000];

function check(m) {
  assert.equal(r(m, 0x8025), 0x05, "(0x8025) = 5");
  assert.equal(r(m, 0x8027), 0x05, "(0x8027) = 5");
  assert.equal(r(m, 0x802d), 0x04, "(0x802d) = 4");
  assert.equal(r(m, 0x802f), 0x04, "(0x802f) = 4");
  assert.equal(r(m, 0x8035), 0x07, "(0x8035) = 7");
  assert.equal(r(m, 0x8037), 0x07, "(0x8037) = 7");
  assert.equal(r(m, 0x8021), 0x06, "(0x8021) = 6");
  assert.equal(r(m, 0x803b), 0x06, "(0x803b) = 6");
  assert.equal(r(m, 0x8011), 0x05, "loop seeded (0x8011) = 5");
  assert.equal(r(m, 0x801d), 0x05, "loop seeded (0x801d) = 5");
  assert.equal(r(m, 0x801f), 0x05, "loop reached the 10th cell (0x801f) = 5");
  assert.equal(r(m, 0x8010), 0x00, "odd cell (0x8010) untouched");
  assert.equal(r(m, 0x800d), 0x02, "(0x800d) overwritten to 2");
  assert.equal(r(m, 0x800f), 0x02, "(0x800f) overwritten to 2");
  assert.equal(r(m, 0x8015), 0x02, "(0x8015) overwritten to 2");
  assert.equal(r(m, 0x801b), 0x02, "(0x801b) overwritten to 2");
  assert.equal(r(m, 0x8029), 0x05, "(0x8029) = 5");
  assert.equal(r(m, 0x8033), 0x05, "(0x8033) = 5");
}

test("loc_1a02: seeds the lane-anim state block and returns", () => {
  const m = mk();
  loc_1a02(m);
  check(m);
  assert.equal(m.regs.sp, 0x8800, "ret popped the caller frame");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_1a02.js
//   find: regs.a = 0x07;
//   repl: regs.a = 0x06;   // seeds 0x8035/0x8037 with 6 instead of sprite frame 7
//   expect: FAIL  ((0x8035) != 7 -- caught by check)
//   verified-anchor: the sole 0x07 immediate; value 7 is stored only to (0x8035)/(0x8037)
// Simulated by rewriting the value-7 stores to 6, which is what the edit produces.
test("loc_1a02: the contract catches a wrong lane-3 frame value", () => {
  const m = mk();
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, v, o) => ow(a, v === 0x07 ? 0x06 : v, o);
  loc_1a02(m);
  assert.throws(() => check(m));
});
