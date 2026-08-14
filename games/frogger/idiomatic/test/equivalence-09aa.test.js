// SPDX-License-Identifier: GPL-3.0-only
/**
 * resetFrogObject — memory+A-equivalent to the frozen oracle at ROM 0x09aa.
 * GATE: crafted-entry. Attract never dispatches this frog-reset leaf (probe: 0 over ENTRY_FRAMES),
 * so entries are cloned from a booted attract machine and seeded with varied pre-state. The routine
 * reads no live-in (it loads its own pointer and zeroes A), so any post-boot state is a valid
 * dispatch; its live-out is memory plus A — the ready-flag value 1, which the render caller stores.
 * Teeth: two wrong-value twins (memory arm) and one register twin (the A arm).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { resetFrogObject } from "../resetFrogObject.js";
import { loc_09aa as oracle } from "../../translated/loc_09aa.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const OBJ = 0x8044; // object block base
const READY = 0x83c3; // the ready flag set to 1

let crafted = null;
function entries() {
  if (crafted) return crafted;
  const m = makeMachine();
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the boot run stopped early: ${m.stoppedBy}`);
  crafted = [];
  for (let i = 0; i < 4; i++) {
    const c = m.clone();
    c.regs.a = i * 40; // vary the entry A the routine overwrites to 1
    for (const a of [OBJ, OBJ + 1, OBJ + 2, OBJ + 3, 0x83cd, 0x842d, 0x842c, 0x8269, READY]) {
      c.mem8[a] = (i * 7 + a) & 0xff; // vary the write-set pre-state
    }
    crafted.push(c);
  }
  return crafted;
}

// null == equivalent. Live-out is memory + A; dumpState() is memory only, so A is compared explicitly.
function diff(cand, machine) {
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  if (d) return `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}`;
  if (a.regs.a !== b.regs.a) return `reg A: ${a.regs.a} vs ${b.regs.a}`;
  return null;
}

// broken twins. Each stays faithful then mutates one output the diff must catch.
function brokenWrongObject(m) { resetFrogObject(m); m.mem8[OBJ] = 129; }
function brokenWrongFlag(m) { resetFrogObject(m); m.mem8[READY] = 2; }
function brokenWrongReg(m) { resetFrogObject(m); m.regs.a = (m.regs.a + 1) & 0xff; }

test("CRAFTED: frog-reset is memory+A equivalent on every entry", { skip }, () => {
  const es = entries();
  assert.ok(es.length > 0, "vacuous: no crafted entry");
  for (const e of es) assert.equal(diff(resetFrogObject, e), null, "a crafted entry diverged");
  console.log(`  CRAFTED: ${es.length} entries, oracle == rewrite (memory + A)`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const es = entries();
  const caught = (fn) => es.filter((e) => diff(fn, e)).length;
  assert.equal(caught(brokenWrongObject), es.length, "the wrong-object twin escaped");
  assert.equal(caught(brokenWrongFlag), es.length, "the wrong-flag twin escaped");
  assert.equal(caught(brokenWrongReg), es.length, "the register twin escaped");
  console.log(`  TEETH: wrong-object ${caught(brokenWrongObject)}, wrong-flag ${caught(brokenWrongFlag)}, register ${caught(brokenWrongReg)}`);
});
