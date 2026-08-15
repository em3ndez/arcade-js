// SPDX-License-Identifier: GPL-3.0-only
/**
 * steerSpriteObjectTowardTarget — memory-equivalent to the frozen oracle at ROM 0x2BAB.
 * GATE: crafted-entry. Attract never dispatches this IX sprite-object motion arm (probe: 0 over
 * ENTRY_FRAMES; it runs only in the in-play sprite dispatcher 0x2b83), so a post-boot attract clone
 * gets IX/IY at a descriptor pair (0x8440 / 0x8048) and cells poked for every branch: inactive, timer
 * running, the 0->255 timer edge, the two facings' step toward/away, and both despawn arms (clear vs
 * held by 0x8004). The oracle pushes/pops IX once on the despawn path, so the dead [SP-8,SP) stack
 * scratch is masked; live-out is otherwise memory-only. Teeth: four broken twins. NOTE: links once
 * names.js exports loc_8000, SPRITE_OBJECT_SLOT_B (added in a later pass).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { steerSpriteObjectTowardTarget } from "../steerSpriteObjectTowardTarget.js";
import { loc_2bab as oracle } from "../../translated/loc_2bab.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const IX = 0x8440;
const IY = 0x8048;
const HOLD = 0x8004;
const SHARED = 0x8058;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

let seed = null;
function seedMachine() {
  if (seed) return seed;
  const m = makeMachine();
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the seed run stopped early: ${m.stoppedBy}`);
  seed = m.clone();
  return seed;
}

function entry(pokes) {
  const e = seedMachine().clone();
  e.regs.ix = IX;
  e.regs.iy = IY;
  for (const [a, v] of Object.entries(pokes)) e.mem8[Number(a)] = v;
  return e;
}
const o = (n) => IX + n;
const s = (n) => IY + n;
// point (IX+0x0b) at a controllable target cell in page 0x80, holding value v.
const tgt = (v) => ({ [o(0x0b)]: 0x90, 0x8090: v });

// null == RAM-equivalent, with the dead [SP-8,SP) stack window (the oracle's push/pop residue) masked.
function ramDiff(cand, machine) {
  const sp = machine.regs.sp;
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const sa = a.dumpState(), sb = b.dumpState();
  for (let i = 0; i < sa.length; i++) {
    const addr = a.stateOffsetToAddr(i);
    if (addr != null) {
      const below = (sp - addr) & 0xffff;
      if (below >= 1 && below <= 8) sb[i] = sa[i];
    }
  }
  const d = firstStateDiff(sa, sb, (off) => a.stateOffsetToAddr(off));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

// the clear path: facing!=0, target reached, not held -> despawn clears struct + shared block.
const CLEAR = { [o(6)]: 1, [o(9)]: 1, [o(5)]: 1, [o(0)]: 0x10, [s(0)]: 0x20, [HOLD]: 0,
  [SHARED]: 0x11, [SHARED + 1]: 0x22, [SHARED + 2]: 0x33, [SHARED + 3]: 0x44, ...tgt(0x60) };

// broken twins.
function brokenNoOp() {}
function brokenWrongReload(m) { // faithful except the move-timer reload (7 not 8)
  const { mem8 } = m; const obj = m.regs.ix, spr = m.regs.iy;
  if (mem8[(obj + 6) & 0xffff] === 0) return;
  const t = (mem8[(obj + 9) & 0xffff] - 1) & 0xff; mem8[(obj + 9) & 0xffff] = t; if (t) return;
  mem8[(obj + 9) & 0xffff] = 7; // BUG
  const target = mem8[0x8000 | mem8[(obj + 0x0b) & 0xffff]]; const span = mem8[spr & 0xffff];
  const ds = () => { if (mem8[HOLD] !== 0) return; for (let i = 0; i < 16; i++) mem8[(obj + i) & 0xffff] = 0; for (let i = 0; i < 4; i++) mem8[(SHARED + i) & 0xffff] = 0; };
  if (mem8[(obj + 5) & 0xffff] !== 0) { if (((target - mem8[obj & 0xffff]) & 0xff) >= span) return ds(); mem8[(obj + 2) & 0xffff] = (mem8[(obj + 2) & 0xffff] + 1) & 0xff; return; }
  if (((target - mem8[(obj + 1) & 0xffff]) & 0xff) < span) return ds();
  mem8[(obj + 2) & 0xffff] = (mem8[(obj + 2) & 0xffff] - 1) & 0xff;
}
function brokenSkipShared(m) { // despawn forgets the 4-byte shared block clear
  const { mem8 } = m; const obj = m.regs.ix, spr = m.regs.iy;
  if (mem8[(obj + 6) & 0xffff] === 0) return;
  const t = (mem8[(obj + 9) & 0xffff] - 1) & 0xff; mem8[(obj + 9) & 0xffff] = t; if (t) return;
  mem8[(obj + 9) & 0xffff] = 8;
  const target = mem8[0x8000 | mem8[(obj + 0x0b) & 0xffff]]; const span = mem8[spr & 0xffff];
  const ds = () => { if (mem8[HOLD] !== 0) return; for (let i = 0; i < 16; i++) mem8[(obj + i) & 0xffff] = 0; /* BUG: skip SHARED */ };
  if (mem8[(obj + 5) & 0xffff] !== 0) { if (((target - mem8[obj & 0xffff]) & 0xff) >= span) return ds(); mem8[(obj + 2) & 0xffff] = (mem8[(obj + 2) & 0xffff] + 1) & 0xff; return; }
  if (((target - mem8[(obj + 1) & 0xffff]) & 0xff) < span) return ds();
  mem8[(obj + 2) & 0xffff] = (mem8[(obj + 2) & 0xffff] - 1) & 0xff;
}
function brokenWrongDir(m) { // facing!=0 step decrements instead of increments
  const { mem8 } = m; const obj = m.regs.ix, spr = m.regs.iy;
  if (mem8[(obj + 6) & 0xffff] === 0) return;
  const t = (mem8[(obj + 9) & 0xffff] - 1) & 0xff; mem8[(obj + 9) & 0xffff] = t; if (t) return;
  mem8[(obj + 9) & 0xffff] = 8;
  const target = mem8[0x8000 | mem8[(obj + 0x0b) & 0xffff]]; const span = mem8[spr & 0xffff];
  const ds = () => { if (mem8[HOLD] !== 0) return; for (let i = 0; i < 16; i++) mem8[(obj + i) & 0xffff] = 0; for (let i = 0; i < 4; i++) mem8[(SHARED + i) & 0xffff] = 0; };
  if (mem8[(obj + 5) & 0xffff] !== 0) { if (((target - mem8[obj & 0xffff]) & 0xff) >= span) return ds(); mem8[(obj + 2) & 0xffff] = (mem8[(obj + 2) & 0xffff] - 1) & 0xff; return; } // BUG dec
  if (((target - mem8[(obj + 1) & 0xffff]) & 0xff) < span) return ds();
  mem8[(obj + 2) & 0xffff] = (mem8[(obj + 2) & 0xffff] - 1) & 0xff;
}

test("EQUAL (crafted): steerSpriteObjectTowardTarget == oracle on every path", { skip }, () => {
  const entries = [
    entry({ [o(6)]: 0 }), // inactive
    entry({ [o(6)]: 1, [o(9)]: 5 }), // timer running
    entry({ [o(6)]: 1, [o(9)]: 0 }), // 0 -> 255 timer edge
    entry({ [o(6)]: 1, [o(9)]: 1, [o(5)]: 1, [o(0)]: 0x30, [s(0)]: 0x20, [o(2)]: 5, ...tgt(0x40) }), // facing!=0 step toward
    entry({ [o(6)]: 1, [o(9)]: 1, [o(5)]: 0, [o(1)]: 0x10, [s(0)]: 0x20, [o(2)]: 5, ...tgt(0x60) }), // facing0 step away
    entry({ [o(6)]: 1, [o(9)]: 1, [o(5)]: 1, [o(0)]: 0x10, [s(0)]: 0x20, [HOLD]: 1, ...tgt(0x60) }), // reached but held
    entry(CLEAR), // reached, cleared
  ];
  assert.ok(entries.length > 0, "vacuous: no crafted entries");
  for (const e of entries) assert.equal(ramDiff(steerSpriteObjectTowardTarget, e), null, "a crafted entry diverged");
  assert.ok(ramDiff(brokenNoOp, entry(CLEAR)), "vacuous: oracle wrote nothing on the clear path");
  console.log(`  EQUAL: ${entries.length} crafted paths, steerSpriteObjectTowardTarget == oracle`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const cleared = entry(CLEAR);
  const stepping = entry({ [o(6)]: 1, [o(9)]: 1, [o(5)]: 1, [o(0)]: 0x30, [s(0)]: 0x20, [o(2)]: 5, ...tgt(0x40) });
  assert.ok(ramDiff(brokenNoOp, cleared), "the no-op twin escaped");
  assert.ok(ramDiff(brokenWrongReload, stepping), "the wrong-reload twin escaped");
  assert.ok(ramDiff(brokenSkipShared, cleared), "the skip-shared-clear twin escaped");
  assert.ok(ramDiff(brokenWrongDir, stepping), "the wrong-dir twin escaped");
  console.log("  TEETH: no-op, wrong-reload, skip-shared-clear, wrong-dir all caught");
});
