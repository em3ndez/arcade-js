// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_191e — memory-equivalent to the frozen oracle at ROM 0x191e. Below the cap it bumps a counter,
 * raises an event flag, and enqueues a command word (dissolved tail-jump into the command-queue writer);
 * at/above the cap it does nothing. Every effect is work-RAM (the counter, the flag, the command queue),
 * so the live-out is RAM only; the counter pointer is threaded into the enqueue as its restored HL but
 * is not consumed. The seed arms a free queue slot so the enqueue is observable. Teeth exercise the bump
 * and the cap (no-op) paths.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { loc_191e as cand } from "../loc_191e.js";
import { loc_191e as oracle } from "../../translated/loc_191e.js";

const COUNTER = 0x4002;
const EVENT_FLAG = 0x41c9;
const QUEUE_HEAD = 0x40a0;
const QUEUE_BASE = 0x4000;
const HEAD = 0xc0;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

function armQueue(mem8) {
  mem8[QUEUE_HEAD] = HEAD;
  mem8[QUEUE_BASE + HEAD] = 0x80; // bit7 set = free
}

// Counter below the cap -> bump + flag + enqueue 0x07:0x01.
const bumpEntry = () => craft((mem8, m) => {
  m.push16(0x9999); armQueue(mem8);
  mem8[COUNTER] = 5;
  mem8[EVENT_FLAG] = 0;
});

// Counter at the cap (0x63) -> ret nc, nothing happens.
const capEntry = () => craft((mem8, m) => {
  m.push16(0x9999); armQueue(mem8);
  mem8[COUNTER] = 0x63;
  mem8[EVENT_FLAG] = 0;
});

test("EQUAL (crafted): loc_191e == oracle on the bump and cap paths (RAM)", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, bumpEntry()), null, "loc_191e diverged on the bump path");
  assert.equal(ramDiff(oracle, cand, capEntry()), null, "loc_191e diverged on the cap path");
  // positive control: bump path advances the counter, raises the flag, enqueues 0x07:0x01.
  const b = bumpEntry(); b.routines = STUBS; oracle(b);
  assert.equal(b.mem8[COUNTER], 6, "positive control: counter bumped 5->6");
  assert.equal(b.mem8[EVENT_FLAG], 1, "positive control: event flag raised");
  assert.equal(b.mem8[QUEUE_BASE + HEAD], 0x07, "positive control: command hi byte enqueued");
  assert.equal(b.mem8[QUEUE_BASE + HEAD + 1], 0x01, "positive control: command lo byte enqueued");
  // positive control: cap path leaves the counter untouched.
  const c = capEntry(); c.routines = STUBS; oracle(c);
  assert.equal(c.mem8[COUNTER], 0x63, "positive control: counter held at the cap");
  assert.equal(c.mem8[EVENT_FLAG], 0, "positive control: no flag raised at the cap");
  console.log("  EQUAL: loc_191e == oracle (RAM), bump + cap paths verified");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const noFlag = (m) => { m.mem8[COUNTER]++; }; // bumps but skips the flag + enqueue
  const noBump = (m) => { m.mem8[EVENT_FLAG] = 1; }; // flag but no counter bump/enqueue
  const ignoreCap = (m) => { m.mem8[COUNTER]++; m.mem8[EVENT_FLAG] = 1; }; // acts at the cap
  assert.ok(ramDiff(oracle, noOp, bumpEntry()), "the no-op twin escaped (bump)");
  assert.ok(ramDiff(oracle, noFlag, bumpEntry()), "the no-flag twin escaped (bump)");
  assert.ok(ramDiff(oracle, noBump, bumpEntry()), "the no-bump twin escaped (bump)");
  assert.ok(ramDiff(oracle, ignoreCap, capEntry()), "the ignore-cap twin escaped (cap)");
  console.log("  TEETH: no-op, no-flag, no-bump, ignore-cap all caught");
});
