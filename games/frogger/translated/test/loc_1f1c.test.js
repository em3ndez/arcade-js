// SPDX-License-Identifier: GPL-3.0-only
// Drafter test for loc_1f1c (ROM 0x1F1C-0x1FC6): frog-reached-HOME goal scoring + reset. Stamps the 2x2
// home tiles 0x6C-0x6F at HL, adds BCD score (loc_08e0), refreshes display (loc_08c5, the interior
// 0x08c5 entry of the translated loc_0870 -- STUBBED here, the lead exposes it at merge), and in play
// mode fans out to the fanfare/pointer arm, the board-clear arm (loc_07e6 + a 0xB040 strip), or attract.
// All CALL/rst-0x18 callees (08e0/27bc/08c5/07e6/0018) are SP-balanced stubs.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_1f1c } from "../loc_1f1c.js";

const bal = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; };

function mk() {
  const routines = new Map([
    [0x08e0, bal], [0x27bc, bal], [0x08c5, bal], [0x07e6, bal], [0x0018, bal],
  ]);
  const m = new Machine(new Uint8Array(0x4000), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.regs.hl = 0xaaa4; // a home slot in video RAM (offset 0x2a4)
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}
const r = (m, a) => m.mem.workRam[a - 0x8000];
const w = (m, a, v) => { m.mem.workRam[a - 0x8000] = v; };
const v = (m, i) => m.mem.videoRam[i];

function checkTiles(m) {
  assert.equal(v(m, 0x2a4), 0x6c, "top-left home tile");
  assert.equal(v(m, 0x2a5), 0x6d, "top-right");
  assert.equal(v(m, 0x2c4), 0x6e, "bottom-left (HL + 0x20)");
  assert.equal(v(m, 0x2c5), 0x6f, "bottom-right");
}
function checkReset(m) {
  assert.equal(r(m, 0x826a), 0x20, "(0x826a) = 0x20");
  assert.equal(r(m, 0x826c), 0x01, "(0x826c) = 1 -- active-frog re-seed");
  assert.equal(r(m, 0x83cd), 0x01, "(0x83cd) = 1");
  assert.equal(r(m, 0x8268), 0x10, "(0x8268) = 0x10");
  assert.equal(r(m, 0x8047), 0xf0, "(0x8047) = 0xf0");
  for (const a of [0x8044, 0x8045, 0x8046, 0x829b, 0x83ea, 0x824d, 0x8249, 0x8251])
    assert.equal(r(m, a), 0x00, `(0x${a.toString(16)}) cleared`);
}

test("loc_1f1c: attract ((0x83fe)==0) stamps tiles, scores, re-seeds; 447 T", () => {
  const m = mk();
  for (const a of [0x8044, 0x8045, 0x8046, 0x829b, 0x83ea, 0x824d, 0x8249, 0x8251]) w(m, a, 0xff);
  loc_1f1c(m);
  checkTiles(m);
  checkReset(m);
  assert.deepEqual(m.calls, [0x08e0, 0x08c5, 0x0018], "no (0x8134) bonus, no play-mode fanfare");
  assert.equal(m.cycles, 447, "hand-summed attract path (stubs charge 0)");
});

test("loc_1f1c: (0x8134) bonus arm prepends the 0x20 score add", () => {
  const m = mk();
  w(m, 0x8134, 1); // bonus flag -> the 0x1f22 branch runs 08e0 + 27bc first
  loc_1f1c(m);
  checkTiles(m);
  assert.deepEqual(m.calls, [0x08e0, 0x27bc, 0x08e0, 0x08c5, 0x0018], "bonus add, then the body");
});

test("loc_1f1c: play mode, 4th home clears the board (loc_07e6 + 0xB040 strip)", () => {
  const m = mk();
  w(m, 0x8134, 1); w(m, 0x83fe, 1); w(m, 0x83fd, 1); w(m, 0x825c, 4); w(m, 0x842f, 0xff);
  m.mem.objRam[0x40] = 0xff; m.mem.objRam[0x57] = 0xff;
  loc_1f1c(m);
  assert.equal(r(m, 0x842f), 0x04, "(0x842f) = home count 4");
  assert.equal(m.mem.objRam[0x40], 0x00, "0xB040 strip start cleared");
  assert.equal(m.mem.objRam[0x57], 0x00, "0xB040 strip end (L=0x57) cleared");
  checkReset(m);
  assert.deepEqual(
    m.calls,
    [0x08e0, 0x27bc, 0x08e0, 0x08c5, 0x0018, 0x0018, 0x07e6, 0x27bc, 0x0018],
    "bonus, body scoring, two fanfare rsts, board-clear 07e6, 27bc, re-seed rst",
  );
});

test("loc_1f1c: play mode, non-final home counts the fanfare index down", () => {
  const m = mk();
  w(m, 0x8134, 1); w(m, 0x83fe, 1); w(m, 0x83fd, 1); w(m, 0x825c, 1); w(m, 0x8381, 3);
  loc_1f1c(m);
  assert.equal(r(m, 0x8381), 0x02, "(0x8381)-- from 3 to 2, no reload");
  assert.equal(r(m, 0x8382), 0x00, "(0x8382) = table pointer low (zero ROM)");
  assert.equal(r(m, 0x8383), 0x00, "(0x8382) = table pointer high (zero ROM)");
  checkReset(m);
});

test("loc_1f1c: fanfare index reloads to 0x14 when it hits zero", () => {
  const m = mk();
  w(m, 0x8134, 1); w(m, 0x83fe, 1); w(m, 0x83fd, 1); w(m, 0x825c, 1); w(m, 0x8381, 1);
  loc_1f1c(m);
  assert.equal(r(m, 0x8381), 0x14, "(0x8381) 1 -> 0 -> reload 0x14");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_1f1c.js
//   find: mem.write8(regs.hl, 0x6c);
//   repl: mem.write8(regs.hl, 0x00);   // top-left home tile not stamped
//   expect: FAIL  (videoRam[0x2a4] != 0x6c -- caught by checkTiles)
//   verified-anchor: count == 1  (the sole 0x6c tile store in loc_1f1c)
// Simulated by intercepting exactly the 0x6c stamp, which is what the edit produces.
test("loc_1f1c: the contract catches a dropped home tile", () => {
  const m = mk();
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, val, o) => ow(a, val === 0x6c ? 0x00 : val, o);
  loc_1f1c(m);
  assert.throws(() => checkTiles(m));
});
