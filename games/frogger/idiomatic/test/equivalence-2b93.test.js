// SPDX-License-Identifier: GPL-3.0-only
/**
 * writeSpriteObjectSlotX — memory-equivalent to the frozen oracle at ROM 0x2B93.
 * GATE: crafted-entry. Attract NEVER dispatches this IX sprite-object arm (probe: 0 dispatches over
 * ENTRY_FRAMES; it runs only from the in-play sprite dispatcher 0x2b83), so a post-boot attract clone
 * gets IX/IY at a descriptor pair (0x8490 / 0x8058) and the struct + 0x80-page table cells poked for
 * each path: the inactive early-out, an active write, the (table - (IX+2)) subtraction wrap, and a
 * high table index. Live-in IX/IY + RAM; the sprite slot cells are pre-dirtied so the writes are
 * observable. The one caller makes another call immediately, so LIVE-OUT is memory-only: RAM is
 * compared, registers/SP are not. No push/call, so no dead stack scratch. Teeth: four broken twins.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { writeSpriteObjectSlotX } from "../writeSpriteObjectSlotX.js";
import { loc_2b93 as oracle } from "../../translated/loc_2b93.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const IX = 0x8490;
const IY = 0x8058;
const TABLE_PAGE = 0x8000;
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

// A post-boot clone with IX/IY at a descriptor pair, the struct fields, table byte, and dirtied slot.
function craft({ active, idx, sub, four, tableByte }) {
  const e = seedMachine().clone();
  e.regs.ix = IX;
  e.regs.iy = IY;
  e.mem8[(IX + 0x06) & 0xffff] = active;
  e.mem8[(IX + 0x0b) & 0xffff] = idx;
  e.mem8[(IX + 0x02) & 0xffff] = sub;
  e.mem8[(IX + 0x04) & 0xffff] = four;
  e.mem8[TABLE_PAGE | idx] = tableByte;
  e.mem8[(IY + 0x00) & 0xffff] = 0xaa;
  e.mem8[(IY + 0x03) & 0xffff] = 0xaa;
  return e;
}

// null == RAM-equivalent. Memory-only live-out: compare RAM, not registers or SP.
function ramDiff(cand, machine) {
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

const ACTIVE = { active: 3, idx: 0x40, sub: 0x10, four: 0x07, tableByte: 0x50 };
const PATHS = [
  ["inactive -> ret", { active: 0, idx: 0x40, sub: 0x10, four: 0x07, tableByte: 0x50 }],
  ["active normal", ACTIVE],
  ["active subtraction wrap", { active: 3, idx: 0x42, sub: 0x30, four: 0x22, tableByte: 0x10 }],
  ["active high table index", { active: 1, idx: 0xf0, sub: 0x00, four: 0xff, tableByte: 0x88 }],
];

// broken twins.
function brokenNoOp() {}
function brokenWrongVal(m) { // BUG: wrong (IY+0) value
  const { regs, mem8 } = m;
  if (mem8[(regs.ix + 0x06) & 0xffff] === 0) return;
  mem8[(regs.iy + 0x00) & 0xffff] = 0x77;
  mem8[(regs.iy + 0x03) & 0xffff] = mem8[(regs.ix + 0x04) & 0xffff];
}
function brokenSkipSecond(m) { // BUG: omits the (IY+3) write
  const { regs, mem8 } = m;
  if (mem8[(regs.ix + 0x06) & 0xffff] === 0) return;
  const t = mem8[0x8000 | mem8[(regs.ix + 0x0b) & 0xffff]];
  mem8[(regs.iy + 0x00) & 0xffff] = (t - mem8[(regs.ix + 0x02) & 0xffff]) & 0xff;
}
function brokenNoGuard(m) { // BUG: ignores the active gate, always writes (wrong branch)
  const { regs, mem8 } = m;
  const t = mem8[0x8000 | mem8[(regs.ix + 0x0b) & 0xffff]];
  mem8[(regs.iy + 0x00) & 0xffff] = (t - mem8[(regs.ix + 0x02) & 0xffff]) & 0xff;
  mem8[(regs.iy + 0x03) & 0xffff] = mem8[(regs.ix + 0x04) & 0xffff];
}

test("EQUAL (crafted): writeSpriteObjectSlotX == oracle on every path", { skip }, () => {
  const entries = PATHS.map(([, cfg]) => craft(cfg));
  assert.ok(entries.length > 0, "vacuous: no crafted entries");
  for (let i = 0; i < entries.length; i++) assert.equal(ramDiff(writeSpriteObjectSlotX, entries[i]), null, `diverged: ${PATHS[i][0]}`);
  assert.ok(ramDiff(brokenNoOp, craft(ACTIVE)), "vacuous: oracle wrote nothing on the active path");
  console.log(`  EQUAL: ${entries.length} crafted paths, writeSpriteObjectSlotX == oracle`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const active = craft(ACTIVE);
  const inactive = craft(PATHS[0][1]);
  assert.ok(ramDiff(brokenNoOp, active), "the no-op twin escaped");
  assert.ok(ramDiff(brokenWrongVal, active), "the wrong-value twin escaped");
  assert.ok(ramDiff(brokenSkipSecond, active), "the skip-second-write twin escaped");
  assert.ok(ramDiff(brokenNoGuard, inactive), "the no-guard twin escaped on the inactive entry");
  console.log("  TEETH: no-op, wrong-value, skip-second, no-guard all caught");
});
