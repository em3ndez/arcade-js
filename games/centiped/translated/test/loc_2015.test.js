// SPDX-License-Identifier: GPL-3.0-only
// Equivalence test for loc_2015 (ROM 0x2015-0x2057), the never-returning main loop. Minimal 6502 harness
// (Regs + flat RAM + the page-1 stack seam), author-derived; a step-count sentinel bounds the loop so the
// step boundaries/cycles/call sequence can be asserted. The whole-machine boot-first state diff vs MAME is
// the integration check. Run: node --test games/centiped/translated/test/loc_2015.test.js
import test from "node:test";
import assert from "node:assert/strict";

import { Regs } from "../../../../core/cpu/6502.js";
import { loc_2015 } from "../loc_2015.js";

function makeMachine() {
  const regs = new Regs();
  const ram = new Uint8Array(0x10000);
  const mem = {
    read8: (a) => ram[a & 0xffff],
    write8: (a, v) => { ram[a & 0xffff] = v & 0xff; },
    read16: (a) => ram[a & 0xffff] | (ram[(a + 1) & 0xffff] << 8),
  };
  return {
    regs, mem, ram, cycles: 0, pc: 0, pcSeq: [], calls: [],
    step(next, c) { this.pc = next; this.cycles += c; this.pcSeq.push(next); },
    push8(v) { mem.write8(0x0100 | regs.s, v & 0xff); regs.s = (regs.s - 1) & 0xff; },
    pull8() { regs.s = (regs.s + 1) & 0xff; return mem.read8(0x0100 | regs.s); },
    push16(v) { this.push8((v >> 8) & 0xff); this.push8(v & 0xff); this._retPushed = true; },
    pull16() { const lo = this.pull8(); const hi = this.pull8(); return lo | (hi << 8); },
    ret(c = 6) { this.step((this.pull16() + 1) & 0xffff, c); },
    call(a) { this.calls.push(a); if (this._retPushed) { this._retPushed = false; this.pull16(); } return undefined; },
  };
}

class Stop extends Error {}
// Run loc_2015 (never returns) and stop it after `limit` m.step calls have executed.
function runBounded(m, limit) {
  const realStep = m.step.bind(m);
  let n = 0;
  m.step = (next, c) => { if (n >= limit) throw new Stop(); n++; realStep(next, c); };
  try { loc_2015(m); } catch (e) { if (!(e instanceof Stop)) throw e; }
}

test("loc_2015: spins skipped, BPL taken loops back to $2015; 40 T over the first pass", () => {
  const m = makeMachine();
  m.ram[0x008a] = 0x01;   // LSR -> C set -> BCC not taken (no spin)
  m.ram[0x0c00] = 0x20;   // IN bit5 set -> AND #$20 nonzero -> BEQ not taken; result 0x20 -> N clear
  m.regs.a = 0x5a;        // sentinel: A is untouched until STA $2000, then $0c00 overwrites it -> distinct
  runBounded(m, 10);      // stop just before the 2nd-pass LSR

  assert.deepEqual(
    m.pcSeq,
    [0x2017, 0x2019, 0x201c, 0x201f, 0x2021, 0x2023, 0x2026, 0x2029, 0x202c, 0x2015],
    "one pass then the BPL-taken back-edge to $2015",
  );
  assert.deepEqual(m.calls, [0x2561, 0x3068, 0x2741], "the first three per-frame JSRs");
  assert.equal(m.ram[0x2000], 0x5a, "STA $2000 kicked the watchdog with A captured at entry (before $0c00)");
  assert.equal(m.cycles, 5 + 2 + 4 + 4 + 2 + 2 + 6 + 6 + 6 + 3, "40 T");
  assert.equal(m.pc, 0x2015, "looped back to $2015");
});

test("loc_2015: BCC spins on $8a until a 1-bit shifts out (taken = 3 T)", () => {
  const m = makeMachine();
  m.ram[0x008a] = 0x04;   // LSR 0x04->0x02(C0)->0x01(C0)->0x00(C1): two taken, then fall
  runBounded(m, 6);

  assert.deepEqual(
    m.pcSeq,
    [0x2017, 0x2015, 0x2017, 0x2015, 0x2017, 0x2019],
    "LSR/BCC spins twice, then falls through",
  );
  assert.deepEqual(m.calls, [], "no JSR reached during the spin");
  assert.equal(m.cycles, 5 + 3 + 5 + 3 + 5 + 2, "23 T");
});

test("loc_2015: BEQ self-loop at $2021 spins while IN bit5 clear (taken = 3 T)", () => {
  const m = makeMachine();
  m.ram[0x008a] = 0x01;   // skip the LSR spin
  m.ram[0x0c00] = 0x00;   // AND #$20 -> 0 -> Z set -> BEQ $2021 self-loop
  runBounded(m, 7);

  assert.deepEqual(
    m.pcSeq,
    [0x2017, 0x2019, 0x201c, 0x201f, 0x2021, 0x2021, 0x2021],
    "AND lands at $2021, then BEQ re-steps to itself each spin",
  );
  assert.deepEqual(m.calls, [], "no JSR reached while spinning");
  assert.equal(m.cycles, 5 + 2 + 4 + 4 + 2 + 3 + 3, "23 T");
});

test("loc_2015: BPL not taken runs the full 13-JSR chain then JMP $2015; 120 T; 16 calls", () => {
  const m = makeMachine();
  m.ram[0x008a] = 0x01;
  m.ram[0x0c00] = 0x20;
  const realCall = m.call.bind(m);
  m.call = (a) => { if (a === 0x2741) m.regs.fN = true; return realCall(a); }; // sub returns N set -> BPL falls
  runBounded(m, 24);

  assert.deepEqual(
    m.calls,
    [0x2561, 0x3068, 0x2741, 0x3ac0, 0x2119, 0x32fe, 0x2951, 0x26fd, 0x2ace,
      0x2202, 0x2ec6, 0x2bd9, 0x2e0b, 0x2059, 0x23da, 0x2cef],
    "all 16 per-frame subsystem JSRs in ROM order",
  );
  assert.deepEqual(
    m.pcSeq,
    [0x2017, 0x2019, 0x201c, 0x201f, 0x2021, 0x2023, 0x2026, 0x2029, 0x202c, 0x202e,
      0x2031, 0x2034, 0x2037, 0x203a, 0x203d, 0x2040, 0x2043, 0x2046, 0x2049, 0x204c,
      0x204f, 0x2052, 0x2055, 0x2015],
    "the full chain then JMP $2015",
  );
  assert.equal(m.cycles, 24 + 16 * 6, "8 leaf ops (24 T) + 16 JSR (96 T) = 120 T");
  assert.equal(m.pc, 0x2015, "JMP $2015 back-edge");
});

test("loc_2015 MUTATION: LSR $8a mischarged 4T not 5T is caught by the T-state total", () => {
  const m = makeMachine();
  m.ram[0x008a] = 0x01;
  m.ram[0x0c00] = 0x20;
  const realStep = m.step.bind(m);
  let n = 0;
  m.step = (next, c) => {
    if (n >= 10) throw new Stop();
    n++;
    realStep(next, next === 0x2017 ? 4 : c); // the LSR step lands at 0x2017
  };
  try { loc_2015(m); } catch (e) { if (!(e instanceof Stop)) throw e; }
  assert.notEqual(m.cycles, 40, "a mischarged cycle blows the golden T-state total");
});
