// SPDX-License-Identifier: GPL-3.0-only
/**
 * fillTenCellRun — memory-equivalent to the frozen oracle at ROM 0x0779.
 * GATE: crafted-entry. This ten-cell fill runs in score-display setup, which plain attract never
 * reaches (measured: 0 dispatches in 6000 attract frames). A corpus of REAL attract machine states is
 * captured (snapshotted at the column-copy primitive, which fires constantly); on each, the base is
 * poked to the real field bases the caller steps through, identically on both sides, and oracle and
 * rewrite are compared. Live-out is NOT memory-only: the caller reads back the advanced pointer and
 * relies on the counter being drained to zero, so a register arm compares HL and B in addition to
 * RAM. Teeth: three that make a RAM difference, two that make only a register difference.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { ROUTINES as TRANSLATED } from "../../routines.js";
import { fillTenCellRun } from "../fillTenCellRun.js";
import { loc_0779 as oracle } from "../../translated/loc_0779.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const STATE_SOURCE = 0x0028;
const CAP = 120;
const STRIDE = 90;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

// The real field bases: the caller starts at 0xa806 and lays two fills per row (the second 12 cells
// on from the first), stepping down one 32-cell row each pass.
const BASES = [];
for (let row = 0; row < 10; row++) { const b = (0xa806 + row * 32) & 0xffff; BASES.push(b, (b + 12) & 0xffff); }

let states = null;
function corpus() {
  if (states) return states;
  const out = [];
  let seen = 0;
  const real = TRANSLATED.get(STATE_SOURCE);
  const m = makeMachine(new Map([[STATE_SOURCE, (mm) => {
    if (seen++ % STRIDE === 0 && out.length < CAP) out.push(mm.clone());
    return real(mm);
  }]]));
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the capture run stopped early: ${m.stoppedBy}`);
  states = out;
  return states;
}

// Real attract VRAM at these cells already holds the fill tile, so a fresh fill would be invisible.
// The surgical nudge: paint the run (and margins) with a sentinel on BOTH sides first, so every cell
// the routine writes is observable and a missed/extra/wrong write shows as a difference.
const SENTINEL = 0xee;
function paint(m, base) {
  const { mem8 } = m;
  for (let a = (base - 1) & 0xffff, end = (base + 12) & 0xffff; a !== end; a = (a + 1) & 0xffff) mem8[a] = SENTINEL;
}

// null == equivalent. Live-out is memory + HL + B; compare RAM first, then those two registers.
function breach(cand, machine, base) {
  const a = machine.clone(); paint(a, base); a.regs.hl = base; oracle(a);
  const b = machine.clone(); paint(b, base); b.regs.hl = base; cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  if (d) return `RAM 0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}`;
  if (a.regs.hl !== b.regs.hl) return `HL: ${a.regs.hl} vs ${b.regs.hl}`;
  if (a.regs.b !== b.regs.b) return `B: ${a.regs.b} vs ${b.regs.b}`;
  return null;
}

function brokenNoOp() {}
function brokenShort(m, base = m.regs.hl) { // fills nine cells
  const { mem8 } = m; let p = base;
  for (let i = 0; i < 9; i++) { mem8[p] = 16; p = (p + 1) & 0xffff; }
  m.regs.hl = p; m.regs.b = 0;
}
function brokenWrongTile(m, base = m.regs.hl) {
  const { mem8 } = m; let p = base;
  for (let i = 0; i < 10; i++) { mem8[p] = 17; p = (p + 1) & 0xffff; }
  m.regs.hl = p; m.regs.b = 0;
}
function brokenStaleHL(m, base = m.regs.hl) { fillTenCellRun(m, base); m.regs.hl = base; }   // correct RAM+B, HL not advanced
function brokenNonzeroB(m, base = m.regs.hl) { fillTenCellRun(m, base); m.regs.b = 5; }        // correct RAM+HL, counter not drained

test("CRAFTED: over real attract states x real bases, oracle == rewrite", { skip }, () => {
  const c = corpus();
  assert.ok(c.length > 0, "vacuous: no attract states were captured");
  for (const s of c) for (const base of BASES) assert.equal(breach(fillTenCellRun, s, base), null, `diverged at base 0x${base.toString(16)}`);
  console.log(`  CRAFTED: ${c.length} states x ${BASES.length} bases, oracle == rewrite (RAM + HL + B)`);
});

test("TEETH: RAM twins are caught", { skip }, () => {
  const c = corpus();
  const base = BASES[0];
  for (const [name, twin] of [["no-op", brokenNoOp], ["short", brokenShort], ["wrong-tile", brokenWrongTile]]) {
    assert.ok(c.some((s) => { const b = breach(twin, s, base); return b && b.startsWith("RAM"); }), `the ${name} twin escaped the RAM diff on every state`);
  }
  console.log("  TEETH/RAM: no-op, short, wrong-tile caught by the RAM diff");
});

test("TEETH: register-only twins are caught ON THE REGISTER ARM", { skip }, () => {
  const c = corpus();
  const base = BASES[0];
  assert.ok(c.some((s) => { const b = breach(brokenStaleHL, s, base); return b && b.startsWith("HL"); }), "the stale-HL twin was not caught on the HL check — the arm may be inert");
  assert.ok(c.some((s) => { const b = breach(brokenNonzeroB, s, base); return b && b.startsWith("B"); }), "the nonzero-B twin was not caught on the B check — the arm may be inert");
  console.log("  TEETH/regs: stale-HL and nonzero-B caught by the register arm (RAM was identical)");
});
