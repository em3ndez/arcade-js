// SPDX-License-Identifier: GPL-3.0-only
// loc_0a5f: award an extra life (per-player count) + stamp the lives-row marker unless capped.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0a5f } from "../loc_0a5f.js";

function mk() {
  const m = new Machine(new Uint8Array(0x4000), new Map());
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.mem.workRam[0x3cc] = 0xff; // so the (0x83CC) clear is observable
  return m;
}
const w = (m, a) => m.mem.workRam[a - 0x8000];
const vr = (m, a) => m.mem.videoRam[a - 0xa800];

test("loc_0a5f: player 1 life 3->4, marker tile at 0xA85E + 4*0x20; 178 T", () => {
  const m = mk();
  m.mem.workRam[0x3fd] = 0x01;
  m.mem.workRam[0x3b8] = 0x03;
  loc_0a5f(m);
  assert.equal(w(m, 0x83cc), 0x00, "(0x83CC) cleared");
  assert.equal(w(m, 0x83b8), 0x04, "P1 count bumped");
  assert.equal(w(m, 0x83b7), 0x04, "(0x83B7) mirror");
  assert.equal(vr(m, 0xa8de), 0x4c, "marker tile 0x4C stamped");
  assert.equal(m.cycles, 178, "stamp-path T");
});

test("loc_0a5f: player 2 bumps 0x83B9, leaves 0x83B8; 177 T", () => {
  const m = mk();
  m.mem.workRam[0x3fd] = 0x02;
  m.mem.workRam[0x3b8] = 0x0a;
  m.mem.workRam[0x3b9] = 0x03;
  loc_0a5f(m);
  assert.equal(w(m, 0x83b9), 0x04, "P2 count bumped");
  assert.equal(w(m, 0x83b8), 0x0a, "P1 count untouched");
  assert.equal(w(m, 0x83b7), 0x04, "(0x83B7) mirror");
  assert.equal(vr(m, 0xa8de), 0x4c, "marker stamped");
  assert.equal(m.cycles, 177, "inc-l path T");
});

test("loc_0a5f: count reaching 0x10 caps -> ret nc, no marker; 105 T", () => {
  const m = mk();
  m.mem.workRam[0x3fd] = 0x01;
  m.mem.workRam[0x3b8] = 0x0f;
  loc_0a5f(m);
  assert.equal(w(m, 0x83b8), 0x10, "count bumped to 0x10");
  assert.equal(w(m, 0x83b7), 0x10, "(0x83B7) mirror");
  assert.equal(vr(m, 0xa85e), 0x00, "no marker stamped (capped)");
  assert.equal(m.cycles, 105, "cap-path T");
});

test("loc_0a5f: a 1-T undercharge on the mirror store is caught", () => {
  const m = mk();
  m.mem.workRam[0x3fd] = 0x01;
  m.mem.workRam[0x3b8] = 0x03;
  const os = m.step.bind(m);
  m.step = (a, t) => os(a, a === 0x0a72 && t === 13 ? 12 : t);
  loc_0a5f(m);
  assert.equal(m.cycles, 177, "undercharge shows");
});
