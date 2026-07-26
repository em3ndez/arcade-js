// SPDX-License-Identifier: GPL-3.0-only
/**
 * Gate for the indexable memory views (core/mem-views.js) — the readability sugar the
 * idiomatic layer uses (mem8[ADDR] / mem16[ADDR]) in place of read8/write8/read16/write16.
 *
 * The whole safety claim of the sweep that adopts this syntax is: the views are byte-for-
 * byte the same memory operations as the method calls, so they cannot perturb the
 * equivalence gate. This test proves exactly that — get == read, set == write, width
 * wraparound preserved, 16-bit little-endian, and a machine state written via the views
 * dumps identically to one written via the methods. Plus TEETH: a deliberately-broken
 * view IS caught, so the comparison has bite.
 *
 * The core-view tests build an AddressSpace directly (no ROM needed). The machine-wiring
 * block is ROM-gated (builds a real Machine to check m.mem8/m.mem16 and clone isolation).
 *
 * Run: node --test boards/thepit/test/mem-views.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { AddressSpace, WORK_RAM_BASE, COLOR_RAM_BASE, VIDEO_RAM_BASE } from "../memory.js";
import { Io } from "../io.js";
import { makeIndexedView } from "../../../core/mem-views.js";

const rom = () => new Uint8Array(0x5000); // 20KB dummy program (RAM tests need no real code)
const fresh = () => new AddressSpace(rom(), new Io());

// A spread of writable work-RAM / colour / video addresses to exercise.
const RAM_ADDRS = [WORK_RAM_BASE, WORK_RAM_BASE + 0x25, WORK_RAM_BASE + 0x7ff, COLOR_RAM_BASE, VIDEO_RAM_BASE + 0x123];

// -- 8-bit view: get and set mirror read8/write8 -----------------------------

nodeTest("mem8 get == read8 and set == write8 across the writable map", () => {
  const mem = fresh();
  const mem8 = makeIndexedView(mem, 8);

  for (const [i, addr] of RAM_ADDRS.entries()) {
    const v = (i * 37 + 5) & 0xff;
    mem.write8(addr, v);
    assert.equal(mem8[addr], v, `mem8[${addr}] should read what write8 stored`);

    const w = (i * 53 + 11) & 0xff;
    mem8[addr] = w;
    assert.equal(mem.read8(addr), w, `write via mem8[${addr}] should land where read8 sees it`);
    assert.equal(mem8[addr], w);
  }
});

nodeTest("mem8 set applies the 8-bit width mask exactly like write8 (wraparound)", () => {
  const mem = fresh();
  const mem8 = makeIndexedView(mem, 8);
  const addr = WORK_RAM_BASE + 0x10;

  for (const raw of [0, 255, 256, -1, 300, 0x1ff]) {
    mem8[addr] = raw;
    const viaMethod = fresh();
    viaMethod.write8(addr, raw);
    assert.equal(mem.read8(addr), viaMethod.read8(addr), `mem8 set of ${raw} must match write8`);
  }

  // The read-modify-write shape the sugar exists for: `x - 1` at 0 wraps to 255.
  mem8[addr] = 0;
  mem8[addr] = mem8[addr] - 1;
  assert.equal(mem8[addr], 255, "mem8[x] = mem8[x] - 1 wraps 0 -> 255");
});

// -- 16-bit view: get and set mirror read16/write16 (little-endian) ----------

nodeTest("mem16 get == read16, set == write16, little-endian and 16-bit wrap", () => {
  const mem = fresh();
  const mem16 = makeIndexedView(mem, 16);
  const addr = WORK_RAM_BASE + 0x40;

  mem16[addr] = 0x1234;
  assert.equal(mem.read8(addr), 0x34, "low byte at addr");
  assert.equal(mem.read8(addr + 1), 0x12, "high byte at addr+1");
  assert.equal(mem16[addr], 0x1234, "mem16 get round-trips read16");
  assert.equal(mem16[addr], mem.read16(addr), "mem16 get == read16");

  for (const raw of [0, 0xffff, 0x10000, -1, 0x12345]) {
    mem16[addr] = raw;
    const viaMethod = fresh();
    viaMethod.write16(addr, raw);
    assert.equal(mem.read16(addr), viaMethod.read16(addr), `mem16 set of ${raw} must match write16`);
  }
});

// -- inertness to non-numeric keys -------------------------------------------

nodeTest("the view is inert to non-numeric keys (no memory touched)", () => {
  const mem = fresh();
  const mem8 = makeIndexedView(mem, 8);

  // Method/property names and symbols must NOT resolve to a memory access.
  assert.equal(mem8.constructor === Object.prototype.constructor || mem8.constructor === undefined, true);
  assert.equal(mem8[Symbol.iterator], undefined);
  assert.equal(mem8.read8, undefined, "the view exposes no method surface");
  assert.equal(mem8["0x8010"], undefined, "a hex-string key is not a canonical index -> falls through");

  // A stray property set stays on the proxy target, never reaching memory.
  mem8.scratch = 7;
  assert.equal(mem8.scratch, 7);
});

// -- the equivalence claim: views cannot perturb dumpState -------------------

nodeTest("a machine state written via the views dumps identically to one via the methods", () => {
  const viaViews = fresh();
  const viaMethods = fresh();
  const mem8 = makeIndexedView(viaViews, 8);
  const mem16 = makeIndexedView(viaViews, 16);

  for (const [i, addr] of RAM_ADDRS.entries()) {
    const v = (i * 91 + 3) & 0xff;
    mem8[addr] = v;
    viaMethods.write8(addr, v);
  }
  mem16[WORK_RAM_BASE + 0x50] = 0xbeef;
  viaMethods.write16(WORK_RAM_BASE + 0x50, 0xbeef);

  assert.deepEqual(viaViews.dumpState(), viaMethods.dumpState(), "view writes must be byte-identical to method writes");
});

nodeTest("TEETH: a broken view (wrong width mask) is caught by the dumpState compare", () => {
  const good = fresh();
  const bad = fresh();
  const mem8 = makeIndexedView(good, 8);
  // A deliberately-broken view that masks to 7 bits instead of 8.
  const brokenSet = (addr, value) => bad.write8(addr, value & 0x7f);

  const addr = WORK_RAM_BASE + 0x60;
  mem8[addr] = 200;
  brokenSet(addr, 200);
  assert.notEqual(good.read8(addr), bad.read8(addr), "the broken 7-bit view must diverge (200 -> 72)");
  assert.notDeepEqual(good.dumpState(), bad.dumpState(), "and the dumpState compare must catch it");
});

// -- dynamic accessor: the view honors a later rebind, never captures --------

nodeTest("TEETH: the view routes through a read8/write8 rebound AFTER construction (dynamic, not captured)", () => {
  const mem = fresh();
  const mem8 = makeIndexedView(mem, 8);
  const addr = WORK_RAM_BASE + 0x70;

  mem.write8(addr, 0x11);
  assert.equal(mem8[addr], 0x11, "baseline reads through");

  // Rebind read8 after the view was built — exactly what core/entropy-pin.js does. A
  // view that captured read8 at construction would miss this; a dynamic view honors it.
  const origRead8 = mem.read8.bind(mem);
  mem.read8 = (a) => (a === addr ? 0xab : origRead8(a));
  assert.equal(mem8[addr], 0xab, "the view must reflect the rebound read8 (dynamic lookup, not captured)");

  // A write rebind is honored the same way.
  let captured = null;
  const origWrite8 = mem.write8.bind(mem);
  mem.write8 = (a, v) => { captured = { a, v }; return origWrite8(a, v); };
  mem8[addr] = 0x5c;
  assert.deepEqual(captured, { a: addr, v: 0x5c }, "the view must route sets through the rebound write8");
});

// -- machine wiring + clone isolation (ROM-gated) ----------------------------

const ROM_PATH = new URL("../../../games/thepit/rom/maincpu.bin", import.meta.url);
const ROM_PRESENT = existsSync(ROM_PATH);
const romTest = ROM_PRESENT
  ? nodeTest
  : (name, fn) => nodeTest(name, { skip: "skipped: ROM not present at games/thepit/rom/maincpu.bin" }, fn);

romTest("the machine exposes mem8/mem16 that round-trip, and clone() carries independent views", async () => {
  const { makeMachineFactory } = await import("../../../games/thepit/machine.js");
  const ROM = new Uint8Array(readFileSync(ROM_PATH));
  const makeMachine = await makeMachineFactory(ROM);
  const m = makeMachine();

  const addr = WORK_RAM_BASE + 0x30;
  m.mem8[addr] = 0x2a;
  assert.equal(m.mem.read8(addr), 0x2a, "m.mem8 writes reach m.mem");
  assert.equal(m.mem8[addr], 0x2a);
  m.mem16[addr] = 0x0403;
  assert.equal(m.mem.read16(addr), 0x0403, "m.mem16 writes reach m.mem");

  // A clone's views must bind to the clone's own memory, not the source's.
  const c = m.clone();
  assert.equal(c.mem8[addr], 0x03, "clone starts equal (low byte of 0x0403)");
  c.mem8[addr] = 0x99;
  assert.equal(c.mem.read8(addr), 0x99, "clone.mem8 writes the clone");
  assert.equal(m.mem.read8(addr), 0x03, "and does NOT touch the source machine");
});
