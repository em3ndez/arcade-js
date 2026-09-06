// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1344 — memory-equivalent to the frozen oracle at ROM 0x1344.
 * The attacker-launcher's live-outs are all work RAM (in the state dump): it consumes the refill
 * trigger (0x4228), seeds an object slot (0x4390 block), clears a formation cell (0x415c), and — via
 * the dissolved enqueue tail — appends a spawn word into the command queue (0x40c0/0x40c1) and bumps
 * the write-head (0x40a0). So EQUAL is asserted with ramDiff==null across two paths:
 *   - SPAWN: trigger set, gate open, an empty slot + occupied column + filled grid cell -> full launch.
 *   - GATE CLOSED: trigger set but the region-clear gate (0x4220) set -> consume the trigger, nothing else.
 * Positive controls confirm the oracle really writes the queue (spawn) and really clears the trigger
 * (gate). Teeth: a no-op, a queue-scribble (proves ramDiff sees the enqueue region), and a gate-overrun.
 * The return-stack window is masked by ramDiff.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { launchAttackerFromFormation as cand } from "../launchAttackerFromFormation.js";
import { loc_1344 as oracle } from "../../translated/loc_1344.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const TRIGGER = 0x4228;   // one-shot refill trigger (consumed)
const GATE = 0x4220;      // region-clear gate (bit 0 set = hold off)
const PACE_LO = 0x421a;   // pace counter low
const PACE_HI = 0x421b;   // pace counter high
const SLOT_TOP = 0x4391;  // top object slot's high byte
const SLOT = 0x4390;      // claimed slot base (SLOT_TOP - 1)
const DIRECTION = 0x4215; // launch direction / column-scan orientation
const COL_HIGH = 0x41fc;  // high end of the occupancy column row
const SWEEP_MODE = 0x41ef;// bit 0 selects the grid geometry
const GRID_CELL = 0x415c; // the filled formation cell this seed lands on
const QUEUE_HEAD = 0x40a0;
const QUEUE_SLOT = 0x40c0;

// Trigger set, gate open, budget 1 (pace 0/0), the top slot empty, direction 0 (high-end column scan),
// column 0x41fc occupied, sweep-mode set, and the landing grid cell filled -> a full spawn.
const spawnEntry = () => craft((mem, m) => {
  m.push16(0x9999);
  mem[TRIGGER] = 1;
  mem[GATE] = 0;
  mem[PACE_LO] = 0; mem[PACE_HI] = 0;
  mem[SLOT_TOP] = 0; mem[SLOT] = 0;
  mem[DIRECTION] = 0;
  mem[COL_HIGH] = 1;
  mem[SWEEP_MODE] = 1;
  mem[GRID_CELL] = 1;
  mem[QUEUE_HEAD] = 0xc0;
  mem[QUEUE_SLOT] = 0x80; // bit 7 set = slot free
});

// Trigger set but the region-clear gate is set: consume the trigger, then bail before any slot work.
// SLOT is pinned to 0 so the "no launch" control and the gate-overrun tooth are seed-independent.
const gateClosed = () => craft((mem, m) => {
  m.push16(0x9999);
  mem[TRIGGER] = 1;
  mem[GATE] = 1;
  mem[SLOT] = 0;
});

test("EQUAL (crafted): loc_1344 == oracle launches an attacker and enqueues its spawn", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, spawnEntry()), null, "loc_1344 diverged on the spawn path");
  // non-vacuous: the oracle consumes the trigger, seeds the slot, clears the cell, and writes the queue.
  const a = spawnEntry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[TRIGGER], 0, "positive control: trigger not consumed");
  assert.equal(a.mem8[SLOT], 1, "positive control: slot not activated");
  assert.equal(a.mem8[GRID_CELL], 0, "positive control: formation cell not cleared");
  assert.equal(a.mem8[QUEUE_SLOT], 1, "positive control: queue hi byte not written");
  assert.equal(a.mem8[QUEUE_SLOT + 1], 0x5c, "positive control: queue lo byte not written");
  assert.equal(a.mem8[QUEUE_HEAD], 0xc2, "positive control: write-head not advanced");
  console.log("  EQUAL: loc_1344 == oracle (spawn path), queue word 0x015c enqueued");
});

test("EQUAL (crafted): loc_1344 == oracle consumes the trigger then bails on the closed gate", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, gateClosed()), null, "loc_1344 diverged on the gate-closed path");
  const a = gateClosed(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[TRIGGER], 0, "positive control: gate-closed path did not consume the trigger");
  assert.equal(a.mem8[SLOT], 0, "positive control: gate-closed path touched the slot");
  console.log("  EQUAL: loc_1344 == oracle (gate closed), trigger consumed, no launch");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const scribbleQueue = (m) => { cand(m); m.mem8[QUEUE_SLOT + 1] = m.mem8[QUEUE_SLOT + 1] ^ 0xff; };
  const gateOverrun = (m) => { m.mem8[TRIGGER] = 0; m.mem8[SLOT] = 1; }; // ignores the closed gate
  assert.ok(ramDiff(oracle, noOp, spawnEntry()), "no-op twin escaped (spawn)");
  assert.ok(ramDiff(oracle, scribbleQueue, spawnEntry()), "queue-scribble twin escaped (enqueue region)");
  assert.ok(ramDiff(oracle, noOp, gateClosed()), "no-op twin escaped (gate)");
  assert.ok(ramDiff(oracle, gateOverrun, gateClosed()), "gate-overrun twin escaped");
  console.log("  TEETH: no-op, queue-scribble, gate-overrun all caught");
});
