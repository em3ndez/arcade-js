// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0028 — memory-equivalent to the frozen oracle at ROM 0x0028.
 * GATE: real-capture. Attract dispatches this column-copy primitive thousands of times; each captured
 * machine is replayed through oracle and rewrite and their RAM compared. This routine's live-out is
 * NOT memory-only: it leaves both pointers advanced and callers read them back, so a register arm
 * compares HL and DE against the oracle in addition to RAM. Teeth: three that make a RAM difference,
 * two that make only a register difference the RAM diff cannot see.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { ROUTINES as TRANSLATED } from "../../routines.js";
import { loc_0028 } from "../loc_0028.js";
import { loc_0028 as oracle } from "../../translated/loc_0028.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const TARGET = 0x0028;
const CAP = 200;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

let captured = null;
function capture() {
  if (captured) return captured;
  const entries = [];
  const real = TRANSLATED.get(TARGET);
  const m = makeMachine(new Map([[TARGET, (mm) => {
    if (entries.length < CAP) entries.push(mm.clone());
    return real(mm);
  }]]));
  m.runFrames(ENTRY_FRAMES);
  assert.equal(m.stoppedBy, null, `the capture run stopped early: ${m.stoppedBy}`);
  captured = entries;
  return captured;
}

// null == equivalent. Live-out is memory + HL + DE, so compare RAM first, then those two registers.
function breach(cand, machine) {
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  if (d) return `RAM 0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}`;
  if (a.regs.hl !== b.regs.hl) return `HL: ${a.regs.hl} vs ${b.regs.hl}`;
  if (a.regs.de !== b.regs.de) return `DE: ${a.regs.de} vs ${b.regs.de}`;
  return null;
}

// broken twins. The first three write wrong RAM; the last two write CORRECT RAM but a wrong register.
function brokenNoOp() {}
function brokenDownColumn(m) { // steps the destination DOWN instead of up
  const { mem8 } = m;
  let d = m.regs.hl, s = m.regs.de, n = m.regs.b;
  do { mem8[d] = mem8[s]; d = (d + 32) & 0xffff; s = (s + 1) & 0xffff; n = (n - 1) & 0xff; } while (n !== 0);
  m.regs.hl = d; m.regs.de = s;
}
function brokenShort(m) { // copies one byte fewer
  const { mem8 } = m;
  let d = m.regs.hl, s = m.regs.de, n = (m.regs.b - 1) & 0xff;
  if (n === 0) return;
  do { mem8[d] = mem8[s]; d = (d - 32) & 0xffff; s = (s + 1) & 0xffff; n = (n - 1) & 0xff; } while (n !== 0);
  m.regs.hl = d; m.regs.de = s;
}
function brokenStaleHL(m) { const dst = m.regs.hl; loc_0028(m); m.regs.hl = dst; } // correct RAM, HL not advanced
function brokenStaleDE(m) { const src = m.regs.de; loc_0028(m); m.regs.de = src; } // correct RAM, DE not advanced

test("CAPTURE: attract dispatches the copy; oracle == rewrite on every state", { skip }, () => {
  const entries = capture();
  assert.ok(entries.length > 0, "vacuous: the copy was never dispatched in attract");
  for (const e of entries) assert.equal(breach(loc_0028, e), null, "a captured machine diverged");
  console.log(`  CAPTURE: ${entries.length} dispatches, oracle == rewrite (RAM + HL + DE)`);
});

test("TEETH: RAM twins are caught", { skip }, () => {
  const entries = capture();
  assert.ok(entries.length, "no capture to test teeth against");
  for (const [name, twin] of [["no-op", brokenNoOp], ["down-column", brokenDownColumn], ["short", brokenShort]]) {
    assert.ok(entries.some((e) => { const b = breach(twin, e); return b && b.startsWith("RAM"); }), `the ${name} twin escaped the RAM diff on every state`);
  }
  console.log("  TEETH/RAM: no-op, down-column, short all caught by the RAM diff");
});

test("TEETH: register-only twins are caught ON THE REGISTER ARM", { skip }, () => {
  const entries = capture();
  assert.ok(entries.length, "no capture to test teeth against");
  assert.ok(entries.some((e) => { const b = breach(brokenStaleHL, e); return b && b.startsWith("HL"); }), "the stale-HL twin was not caught on the HL check — the arm may be inert");
  assert.ok(entries.some((e) => { const b = breach(brokenStaleDE, e); return b && b.startsWith("DE"); }), "the stale-DE twin was not caught on the DE check — the arm may be inert");
  console.log("  TEETH/regs: stale-HL and stale-DE caught by the register arm (RAM was identical)");
});
