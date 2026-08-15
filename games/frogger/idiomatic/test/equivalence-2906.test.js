// SPDX-License-Identifier: GPL-3.0-only
/**
 * queueFrogOnLogEdgeBlit — memory-equivalent to the frozen oracle at ROM 0x2906.
 * GATE: crafted-entry. From a captured post-boot state the play gate, the phase index (0x81A2) and the
 * busy gate (0x8140) are poked to drive: the not-playing early return; the phase-too-high and
 * phase-too-low rejects; the busy reject; and the in-range enqueue of command 0xD0 via rst 0x18. The
 * enqueue writes the sound/tile ring (work RAM), so RAM is compared with the dead stack masked.
 * Teeth: no-op and a twin that skips the enqueue; positive control the enqueue moves ring memory.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff } from "./_frogHop.js";
import { queueFrogOnLogEdgeBlit as cand } from "../queueFrogOnLogEdgeBlit.js";
import { loc_2906 as oracle } from "../../translated/loc_2906.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const PLAY = 0x83fe, PHASE = 0x81a2, BUSY = 0x8140;

const enqueue = () => craft((mem) => { mem[PLAY] = 1; mem[PHASE] = 0x08; mem[BUSY] = 0; });
const gate = () => craft((mem) => { mem[PLAY] = 0; mem[PHASE] = 0x08; mem[BUSY] = 0; });
const phaseHi = () => craft((mem) => { mem[PLAY] = 1; mem[PHASE] = 0x0f; mem[BUSY] = 0; });
const phaseLo = () => craft((mem) => { mem[PLAY] = 1; mem[PHASE] = 0x01; mem[BUSY] = 0; });
const busy = () => craft((mem) => { mem[PLAY] = 1; mem[PHASE] = 0x08; mem[BUSY] = 1; });

test("EQUAL (crafted): queueFrogOnLogEdgeBlit == oracle on enqueue/gate/phase/busy", { skip }, () => {
  for (const [name, mk] of [["enqueue", enqueue], ["gate", gate], ["phase-hi", phaseHi], ["phase-lo", phaseLo], ["busy", busy]]) {
    assert.equal(ramDiff(oracle, cand, mk()), null, `the ${name} path diverged`);
  }
  console.log("  EQUAL: enqueue + not-playing/phase-hi/phase-lo/busy rejects");
});

test("POSITIVE CONTROL: the enqueue moves ring memory (non-vacuous)", { skip }, () => {
  const e = enqueue(); const a = e.clone(); oracle(a); const b = e.clone();
  const A = a.dumpState(), B = b.dumpState();
  let moved = false;
  for (let i = 0; i < A.length; i++) if (A[i] !== B[i]) { moved = true; break; }
  assert.ok(moved, "the enqueue path wrote no memory — case is vacuous");
  console.log("  POSITIVE CONTROL: enqueue wrote the command ring");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const skipEnqueue = () => {}; // never enqueues on the in-range path
  assert.ok(ramDiff(oracle, noOp, enqueue()), "no-op twin escaped");
  assert.ok(ramDiff(oracle, skipEnqueue, enqueue()), "skip-enqueue twin escaped");
  console.log("  TEETH: no-op and skip-enqueue both caught");
});
