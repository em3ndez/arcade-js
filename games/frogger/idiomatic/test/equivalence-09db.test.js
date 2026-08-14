// SPDX-License-Identifier: GPL-3.0-only
/**
 * renderFilledHomeSlots — memory-equivalent to the frozen oracle at ROM 0x09db.
 * GATE: crafted-entry. Attract never dispatches this home-marker render (probe: 0 over ENTRY_FRAMES).
 * HL is live-in — the render caller passes the occupancy-list pointer — so entries are cloned from a
 * booted attract machine, HL is pointed at that list address, and several occupancy patterns are
 * seeded (each mixing occupied and empty slots, exercising the slot-4 fall-through and ret paths). The
 * oracle emulates the internal call/ret of its tail-stamp helper and scribbles a return address into
 * stack scratch below SP; the rewrite drops it, so that dead window is neutralized before comparing.
 * Live-out is memory-only. Teeth: a no-op and two wrong-value twins.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { renderFilledHomeSlots } from "../renderFilledHomeSlots.js";
import { loc_09db as oracle } from "../../translated/loc_09db.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const LIST = 0x825e; // the address the render caller passes in HL
const SLOT_BASES = [0xab64, 0xaaa4, 0xa9e4, 0xa924, 0xa864];

let crafted = null;
function entries() {
  if (crafted) return crafted;
  const m = makeMachine();
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the boot run stopped early: ${m.stoppedBy}`);
  const patterns = [[1, 0, 1, 0, 1], [0, 1, 0, 1, 0], [1, 1, 1, 1, 1], [0, 0, 0, 0, 1]];
  crafted = patterns.map((pat) => {
    const c = m.clone();
    c.regs.hl = LIST;
    for (let i = 0; i < pat.length; i++) c.mem8[(LIST + i) & 0xffff] = pat[i];
    for (const b of SLOT_BASES) for (const o of [0, 1, 32, 33]) c.mem8[(b + o) & 0xffff] = 0;
    return c;
  });
  return crafted;
}

// null == RAM-equivalent. Neutralize the stack scratch the oracle's internal call/ret leaves below SP.
function ramDiff(cand, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  for (let k = 1; k <= 8; k++) { const w = (sp - k) & 0xffff; a.mem8[w] = 0; b.mem8[w] = 0; }
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

// broken twins: a no-op that stamps nothing, and two twins writing a wrong tile value.
function brokenNoOp() {}
function brokenWrongTop(m) { renderFilledHomeSlots(m); m.mem8[SLOT_BASES[0]] = 200; }
function brokenWrongBottom(m) { renderFilledHomeSlots(m); m.mem8[(SLOT_BASES[2] + 33) & 0xffff] = 201; }

test("CRAFTED: home-marker render is RAM-equivalent on every occupancy pattern", { skip }, () => {
  const es = entries();
  assert.ok(es.length > 0, "vacuous: no crafted entry");
  for (const e of es) assert.equal(ramDiff(renderFilledHomeSlots, e), null, "a crafted entry diverged");
  console.log(`  CRAFTED: ${es.length} patterns, oracle == rewrite`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const es = entries();
  const caught = (fn) => es.filter((e) => ramDiff(fn, e)).length;
  assert.equal(caught(brokenNoOp), es.length, "the no-op twin escaped a pattern");
  assert.equal(caught(brokenWrongTop), es.length, "the wrong-top-tile twin escaped");
  assert.equal(caught(brokenWrongBottom), es.length, "the wrong-bottom-tile twin escaped");
  console.log(`  TEETH: no-op ${caught(brokenNoOp)}, wrong-top ${caught(brokenWrongTop)}, wrong-bottom ${caught(brokenWrongBottom)}`);
});
