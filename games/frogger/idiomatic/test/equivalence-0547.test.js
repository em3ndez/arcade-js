// SPDX-License-Identifier: GPL-3.0-only
/**
 * coldStartClearSlotGates — memory-equivalent to the frozen oracle at ROM 0x0547.
 * GATE: crafted-entry. Cold-start init part one: zero the player-1 slot byte 0x825c and the five
 * primary occupancy gates 0x825e-0x8262, then fall into the shared cold-start mid-entry 0x0557 (which
 * runs 0x0557's own clears before the severed 0x0567 sink). Live-out memory-only; RAM compared, stack
 * masked. Teeth: no-op, a twin that skips one gate, a twin that leaves the slot byte. Positive control:
 * a seeded gate really goes non-zero -> 0.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff } from "./_spineSetup.js";
import { coldStartClearSlotGates as cand } from "../coldStartClearSlotGates.js";
import { loc_0547 as oracle } from "../../translated/loc_0547.js";
import { withOmittedRet } from "../../machine.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const SLOT = 0x825c, GATE0 = 0x825e, GATE4 = 0x8262;

const seeded = () => craft((mem) => { mem[SLOT] = 0x09; mem[GATE0] = 0x07; mem[GATE4] = 0x03; });

test("EQUAL (crafted): coldStartClearSlotGates == oracle", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, seeded()), null, "cold-start clear diverged");
  const e = seeded(); const a = e.clone(); a.routines = e.routines; oracle(a);
  assert.equal(a.mem8[GATE0], 0, "positive control: a seeded gate 0x07 -> 0");
  console.log("  EQUAL: cold-start clear; control gate 0x07->0");
});

test("TEETH: broken twins caught", { skip }, () => {
  const noOp = () => {};
  const skipGate = (m) => { cand(m); m.mem8[GATE0] = 0xaa; };
  const keepSlot = (m) => { cand(m); m.mem8[SLOT] = 0x09; };
  assert.ok(ramDiff(oracle, noOp, seeded()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, skipGate, seeded()), "skip-gate twin escaped");
  assert.ok(ramDiff(oracle, keepSlot, seeded()), "keep-slot twin escaped");
  console.log("  TEETH: no-op, skip-gate, keep-slot all caught");
});

test("SEAM: wireable — hands back the coroutine, SP never checked", { skip }, () => {
  const w = withOmittedRet(cand, 0x0547);
  const r = w(seeded());
  assert.ok(r && typeof r.next === "function" && typeof r.throw === "function",
    "the seam must pass the coroutine handoff through as an iterator");
  console.log("  SEAM: iterator handoff -> wireable");
});
