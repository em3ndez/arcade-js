// SPDX-License-Identifier: GPL-3.0-only
// loc_05f0: bump the active player's mod-5 board counter, redraw the board, tail into loc_08e0.
// Callees are on-disk leaves (0x0018 sound-queue gated off at (0x83FE)=0; 0x08e0 score-adder likewise
// gated), so the real subtree runs deterministically over zeroed RAM.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_05f0 } from "../loc_05f0.js";
import { loc_0018 } from "../loc_0018.js";
import { loc_0629 } from "../loc_0629.js";
import { loc_07e6, loc_07eb } from "../loc_07e6.js";
import { loc_0779 } from "../loc_0779.js";
import { loc_064b } from "../loc_064b.js";
import { loc_223d } from "../loc_223d.js";
import { loc_1a02 } from "../loc_1a02.js";
import { loc_08e0 } from "../loc_08e0.js";

function mk() {
  const routines = new Map([
    [0x0018, loc_0018], [0x0629, loc_0629], [0x07e6, loc_07e6], [0x07eb, loc_07eb], [0x0779, loc_0779],
    [0x064b, loc_064b], [0x223d, loc_223d], [0x1a02, loc_1a02], [0x08e0, loc_08e0],
  ]);
  const m = new Machine(new Uint8Array(0x4000), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}

test("loc_05f0: player 1 bumps (0x8293), sets (0x8380)=1, tails to loc_08e0; 26852 T", () => {
  const m = mk();
  m.mem.write8(0x83fd, 1); // active player 1
  m.mem.write8(0x8293, 0); // counter 0 -> 1 (below the mod-5 wrap)
  loc_05f0(m);
  assert.equal(m.mem.read8(0x8293), 1, "P1 board counter incremented");
  assert.equal(m.mem.read8(0x8380), 1, "(0x8380) set");
  assert.equal(m.calls.at(-1), 0x08e0, "tail-delegates to the score adder");
  assert.equal(m.pc, 0xbeef, "fully unwound through the tail");
  assert.equal(m.regs.sp, 0x8800, "stack balanced");
  assert.equal(m.cycles, 26852, "T total, player-1 non-wrap path");
});

test("loc_05f0: player 1 counter wraps to 0 at 5", () => {
  const m = mk();
  m.mem.write8(0x83fd, 1);
  m.mem.write8(0x8293, 4); // 4 -> 5 -> wrap to 0
  loc_05f0(m);
  assert.equal(m.mem.read8(0x8293), 0, "P1 counter wrapped");
  assert.equal(m.mem.read8(0x8380), 1);
  assert.equal(m.cycles, 26866, "wrap path costs the extra store + jr");
});

test("loc_05f0: player 2 bumps (0x8294), not (0x8293)", () => {
  const m = mk();
  m.mem.write8(0x83fd, 2); // active player != 1 -> player 2 arm
  m.mem.write8(0x8294, 0);
  loc_05f0(m);
  assert.equal(m.mem.read8(0x8294), 1, "P2 counter incremented");
  assert.equal(m.mem.read8(0x8293), 0, "P1 counter untouched");
  assert.equal(m.cycles, 26856, "T total, player-2 non-wrap path");
});

test("loc_05f0: player 2 counter wraps to 0 at 5", () => {
  const m = mk();
  m.mem.write8(0x83fd, 2);
  m.mem.write8(0x8294, 4);
  loc_05f0(m);
  assert.equal(m.mem.read8(0x8294), 0, "P2 counter wrapped");
  assert.equal(m.cycles, 26858);
});
