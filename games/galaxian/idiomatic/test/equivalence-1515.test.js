// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1515 — memory-equivalent to the frozen oracle at ROM 0x1515.
 * A gated prescaler over a block of sub-counters; every live-out is work RAM (0x424a master, the
 * 0x424b.. sub-counters, and the 0x4228 refill flag), all in the state dump, so ramDiff is the whole
 * check. Paths exercised:
 *   - GATE CLOSED x3: play flag clear / status gate 0x4220 bit0 set / inhibit 0x422b bit0 set -> bail.
 *   - MASTER NOT EXPIRED: master > 1 -> tick master, refill flag cleared to 0, no sweep.
 *   - EXPIRED, NO REFILLS: master hits 0 -> reload master, sweep, nothing hits zero, flag untouched.
 *   - EXPIRED, WITH REFILLS: master hits 0 -> reload master, two sub-counters hit zero and refill from
 *     the table, refill flag raised to 1.
 * Teeth: no-op, no-refill-flag, no-master-reload and span-off-by-one twins each make ramDiff non-null.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { paceEnemyLaunchTrigger as cand } from "../paceEnemyLaunchTrigger.js";
import { loc_1515 as oracle } from "../../translated/loc_1515.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const PLAY_FLAG = 0x4200;
const STATUS_GATE = 0x4220;
const INHIBIT = 0x422b;
const PACE = 0x421a;
const STAGE = 0x421b;
const MASTER = 0x424a;
const SUB1 = 0x424b;
const SUB2 = 0x424c;
const SUB3 = 0x424d;
const SUB4 = 0x424e; // just past a span-3 sweep; used by the span-off twin
const REFILL_FLAG = 0x4228;

// Reload-table entries used below: table[0]=0x05 (master), table[1]=0x2f (SUB1), table[3]=0x77 (SUB3).
const T0 = 0x05;
const T1 = 0x2f;
const T3 = 0x77;

// Open all three gates and lay a return word.
function open(mem, mm) {
  mm.push16(0x9999);
  mem[PLAY_FLAG] = mem[PLAY_FLAG] | 0x01;
  mem[STATUS_GATE] = mem[STATUS_GATE] & ~0x01;
  mem[INHIBIT] = mem[INHIBIT] & ~0x01;
}

// Master still counting down (5 -> 4): flag cleared, no sweep.
const notExpired = () => craft((mem, mm) => {
  open(mem, mm);
  mem[MASTER] = 5;
  mem[REFILL_FLAG] = 0x77; // sentinel: must be cleared to 0
});

// span = ((pace 0) + (stage 0)) & 0x0f + 1 = 1: master expires, sole sub-counter does not.
const expiredNoRefill = () => craft((mem, mm) => {
  open(mem, mm);
  mem[PACE] = 0;
  mem[STAGE] = 0;
  mem[MASTER] = 1;
  mem[SUB1] = 5;
  mem[REFILL_FLAG] = 0x77; // sentinel: must stay 0x77 (no refills -> not written)
});

// span = ((pace 2) + (stage 0)) & 0x0f + 1 = 3: master expires, SUB1 and SUB3 refill.
const expiredRefill = () => craft((mem, mm) => {
  open(mem, mm);
  mem[PACE] = 2;
  mem[STAGE] = 0;
  mem[MASTER] = 1;
  mem[SUB1] = 1; // -> 0, refill from table[1]
  mem[SUB2] = 5; // -> 4, no refill
  mem[SUB3] = 1; // -> 0, refill from table[3]
  mem[SUB4] = 9; // untouched by a span-3 sweep; the span-off twin decrements it
  mem[REFILL_FLAG] = 0x00;
});

// Play flag clear -> bail before touching anything.
const playClear = () => craft((mem, mm) => { open(mem, mm); mem[PLAY_FLAG] = mem[PLAY_FLAG] & ~0x01; mem[MASTER] = 5; });
// Status gate 0x4220 bit0 set -> bail.
const statusSet = () => craft((mem, mm) => { open(mem, mm); mem[STATUS_GATE] = mem[STATUS_GATE] | 0x01; mem[MASTER] = 5; });
// Inhibit 0x422b bit0 set -> bail.
const inhibitSet = () => craft((mem, mm) => { open(mem, mm); mem[INHIBIT] = mem[INHIBIT] | 0x01; mem[MASTER] = 5; });

test("EQUAL (crafted): loc_1515 == oracle, master still counting", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, notExpired()), null, "not-expired path diverged");
  const a = notExpired(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[MASTER], 4, "positive control: master ticked 5->4");
  assert.equal(a.mem8[REFILL_FLAG], 0, "positive control: refill flag cleared to 0");
  console.log("  EQUAL: master 5->4, refill flag -> 0, no sweep");
});

test("EQUAL (crafted): loc_1515 == oracle, expired with no refills", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, expiredNoRefill()), null, "expired-no-refill path diverged");
  const a = expiredNoRefill(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[MASTER], T0, "positive control: master reloaded to table[0]");
  assert.equal(a.mem8[SUB1], 4, "positive control: sub-counter ticked 5->4");
  assert.equal(a.mem8[REFILL_FLAG], 0x77, "positive control: no refills -> flag untouched");
  console.log("  EQUAL: master reloaded, sub 5->4, flag untouched (no refills)");
});

test("EQUAL (crafted): loc_1515 == oracle, expired with refills", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, expiredRefill()), null, "expired-refill path diverged");
  const a = expiredRefill(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[MASTER], T0, "positive control: master reloaded to table[0]");
  assert.equal(a.mem8[SUB1], T1, "positive control: SUB1 refilled from table[1]");
  assert.equal(a.mem8[SUB2], 4, "positive control: SUB2 ticked 5->4, no refill");
  assert.equal(a.mem8[SUB3], T3, "positive control: SUB3 refilled from table[3]");
  assert.equal(a.mem8[SUB4], 9, "positive control: SUB4 outside the span, untouched");
  assert.equal(a.mem8[REFILL_FLAG], 1, "positive control: refills happened -> flag raised to 1");
  console.log("  EQUAL: master reloaded, SUB1/SUB3 refilled, SUB4 untouched, flag -> 1");
});

test("EQUAL (crafted): loc_1515 == oracle bails on every closed gate", { skip }, () => {
  for (const [name, e] of [["play flag clear", playClear()], ["status gate set", statusSet()], ["inhibit set", inhibitSet()]]) {
    assert.equal(ramDiff(oracle, cand, e), null, `${name} path diverged`);
    const a = e.clone(); a.routines = STUBS; oracle(a);
    assert.equal(a.mem8[MASTER], 5, `positive control: ${name} -> master untouched`);
  }
  console.log("  EQUAL: all three closed gates bail, master untouched");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const noFlag = (m) => { cand(m); m.mem8[REFILL_FLAG] = 0; };            // drops the raised flag
  const noReload = (m) => { cand(m); m.mem8[MASTER] = 0; };              // fails to reload the master
  const spanOff = (m) => { cand(m); m.mem8[SUB4] = (m.mem8[SUB4] - 1) & 0xff; }; // sweeps one cell too far
  assert.ok(ramDiff(oracle, noOp, expiredRefill()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, noFlag, expiredRefill()), "no-flag twin escaped");
  assert.ok(ramDiff(oracle, noReload, expiredRefill()), "no-reload twin escaped");
  assert.ok(ramDiff(oracle, spanOff, expiredRefill()), "span-off twin escaped");
  console.log("  TEETH: no-op, no-flag, no-reload, span-off all caught");
});
