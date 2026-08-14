// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_0870 (Frogger score-display driver, ROM 0x0870-0x08DF). Callees stubbed with
// SP-balancers (each real callee ends in ret, so +2): rst 0x18=loc_0018, rst 0x28=loc_0028, loc_0aba,
// loc_0ba0, and the two sibling tail targets loc_085b (jp z) / loc_08e0 (fall-through). Covers the guard
// rets, both tail paths, exact writes, T-states, the rst/callee sequence, plus a mutation-patch anchor.

import test from "node:test";
import assert from "node:assert/strict";
import { Machine } from "../../machine.js";
import { loc_0870 } from "../loc_0870.js";

const bal = (mm) => { mm.regs.sp = (mm.regs.sp + 2) & 0xffff; };

// Record entry register state for a stub, then balance the stack it inherits.
function tap(m, log, addr) {
  return (mm) => { log.push({ addr, hl: mm.regs.hl, de: mm.regs.de, b: mm.regs.b }); bal(mm); };
}

function mk() {
  const log = [];
  const routines = new Map();
  for (const a of [0x0018, 0x0028, 0x0aba, 0x0ba0, 0x085b, 0x08e0]) routines.set(a, tap(null, log, a));
  const m = new Machine(new Uint8Array(0x4000), routines);
  m.nextNmi = Infinity; m.nextBoundary = Infinity; m.maxCycles = Infinity; m.maxFrames = Infinity;
  m.regs.sp = 0x8800; m.push16(0xbeef);
  m.tapLog = log;
  m.calls = [];
  const oc = m.call.bind(m);
  m.call = (a, ...r) => { m.calls.push(a); return oc(a, ...r); };
  return m;
}
const r = (m, a) => m.mem.workRam[a - 0x8000];

test("loc_0870: (0x83cd)!=0 rets immediately; 28 T, no callees", () => {
  const m = mk();
  m.mem.workRam[0x3cd] = 0x01;
  loc_0870(m);
  assert.equal(m.cycles, 28, "ld a,(nn)13 + or a 4 + ret nz taken 11");
  assert.deepEqual(m.calls, []);
  assert.equal(m.regs.sp, 0x8800, "ret popped the caller slot");
});

test("loc_0870: (0x8004)!=0 rets after the first guard falls through; 50 T", () => {
  const m = mk();
  m.mem.workRam[0x004] = 0x01;
  loc_0870(m);
  assert.equal(m.cycles, 50, "13+4+5 (guard1 not taken) + 13+4+11 (guard2 ret)");
  assert.deepEqual(m.calls, []);
});

test("loc_0870: first-entry seed + countdown reaching (0x83dd)=0 tail-jumps to loc_085b", () => {
  const m = mk();
  m.mem.workRam[0x3cd] = 0x00; // guard 1 clear
  m.mem.workRam[0x004] = 0x00; // guard 2 clear
  m.mem.workRam[0x3ae] = 0x00; // not seeded -> run the first-entry arm (rst 0x18)
  m.mem.workRam[0x3df] = 0x00; // stay on the countdown arm (no jr to loc_08c5)
  m.mem.workRam[0x3dc] = 0x01; // dec -> 0, so the countdown fires this frame
  m.mem.workRam[0x3dd] = 0x00; // (0x83dd)==0 -> jp z,0x085b
  loc_0870(m);
  assert.equal(r(m, 0x83ae), 0x01, "first-entry seed stored");
  assert.equal(r(m, 0x83dc), 0x20, "countdown reloaded to 0x20");
  assert.deepEqual(m.calls, [0x0018, 0x0aba, 0x085b], "seed tile, field setup, then the no-frogs tail");
  assert.equal(m.cycles, 207, "full first-entry -> loc_085b path");
  assert.equal(m.regs.sp, 0x8800, "loc_085b's ret balances the caller slot");
});

test("loc_0870: countdown not due (dec (0x83dc)!=0) rets without reload", () => {
  const m = mk();
  m.mem.workRam[0x3ae] = 0x01; // already seeded -> jr past the rst 0x18
  m.mem.workRam[0x3df] = 0x00;
  m.mem.workRam[0x3dc] = 0x05; // dec -> 4, ret nz taken
  loc_0870(m);
  assert.equal(r(m, 0x83dc), 0x04, "decremented, not reloaded");
  assert.deepEqual(m.calls, [0x0aba], "only the field setup ran");
});

test("loc_0870: (0x83df)!=0 arm runs loc_08c5 and falls through into loc_08e0", () => {
  const m = mk();
  m.mem.workRam[0x3ae] = 0x01; // seeded
  m.mem.workRam[0x3df] = 0x01; // jr nz -> loc_08c5
  m.mem.workRam[0x3e0] = 0x00; // (0x83e0) clear -> do the blit
  m.mem.workRam[0x3de] = 0x60; // -> DE passed to loc_0ba0
  loc_0870(m);
  assert.equal(r(m, 0x83e0), 0x01, "(0x83e0) set once");
  assert.deepEqual(m.calls, [0x0aba, 0x0028, 0x0ba0, 0x08e0], "setup, blit, loc_0ba0, tail-fall");
  assert.equal(m.cycles, 237, "full (0x83df)!=0 -> loc_08e0 path");
  const blit = m.tapLog.find((e) => e.addr === 0x0028);
  assert.equal(blit.hl, 0xaa51, "rst 0x28 dst"); assert.equal(blit.de, 0x2f6e, "rst 0x28 src");
  assert.equal(blit.b, 0x05, "rst 0x28 count");
  const ba0 = m.tapLog.find((e) => e.addr === 0x0ba0);
  assert.equal(ba0.de, 0x0060, "DE = (0x83de), D zeroed");
  assert.equal(m.regs.sp, 0x8800, "loc_08e0's ret balances the caller slot");
});

test("loc_0870: (0x83df)!=0 with (0x83e0) already set rets inside loc_08c5", () => {
  const m = mk();
  m.mem.workRam[0x3ae] = 0x01;
  m.mem.workRam[0x3df] = 0x01;
  m.mem.workRam[0x3e0] = 0x01; // ret nz taken in loc_08c5, no blit/tail
  loc_0870(m);
  assert.deepEqual(m.calls, [0x0aba], "field setup only, then ret");
});

// MUTATION-PATCH  file: games/frogger/translated/loc_0870.js
//   find: mem.write8(regs.hl, 0x20);
//   repl: mem.write8(regs.hl, 0x21);
//   expect: FAIL  ((0x83dc) reloads to 0x21, the "(0x83dc)==0x20" assert catches it)
//   verified-anchor: count == 1  (the sole write of 0x20 in loc_0870.js, the countdown reload)
// Simulated by intercepting exactly the 0x20->0x83dc store the edit would change.
test("loc_0870: the contract catches a wrong countdown-reload value", () => {
  const m = mk();
  m.mem.workRam[0x3ae] = 0x01;
  m.mem.workRam[0x3df] = 0x00;
  m.mem.workRam[0x3dc] = 0x01;
  m.mem.workRam[0x3dd] = 0x00;
  const ow = m.mem.write8.bind(m.mem);
  m.mem.write8 = (a, val, o) => ow(a, a === 0x83dc && val === 0x20 ? 0x21 : val, o);
  loc_0870(m);
  assert.throws(() => assert.equal(r(m, 0x83dc), 0x20));
});
