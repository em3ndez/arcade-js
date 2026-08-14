// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_0794 — IO-equivalent to the frozen oracle at ROM 0x0794.
 * GATE: real-capture. Plain attract dispatches this sound-command issuer at boot (loc_02a3 issues
 * command 0 then 0xFF); each captured machine is replayed through oracle and rewrite.
 *
 * ★ LIVE-OUT IS IO, NOT RAM. loc_0794's effect is on the two sound PPI ports — 0xD000 (command latch)
 *   and 0xD002 (control, whose bit-3 falling edge asserts the audio /INT). Those writes route to
 *   io.ppiWrite, NOT work/video/obj RAM, so dumpState() cannot see them and a pure RAM diff passes
 *   VACUOUSLY (even a no-op twin). So this gate compares the io sound surface explicitly: io.soundData,
 *   io.soundControl, io.soundTriggers. RAM is also compared and must stay identical. Registers/SP are
 *   not compared. Teeth: three broken twins — a no-op, a wrong command byte, a dropped /INT edge.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { makeMachine, ENTRY_FRAMES, romsPresent } from "./_harness.js";
import { ROUTINES as TRANSLATED } from "../../routines.js";
import { loc_0794 } from "../loc_0794.js";
import { loc_0794 as oracle } from "../../translated/loc_0794.js";
import { firstStateDiff } from "../../../../core/equivalence.js";

const TARGET = 0x0794;
const CAP = 50;
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

// null == equivalent. The live-out is IO (sound latch/control/edge); RAM must also be unchanged.
function ioDiff(cand, machine) {
  const a = machine.clone(); oracle(a);
  const b = machine.clone(); cand(b);
  if (a.io.soundData !== b.io.soundData) {
    return `soundData 0x${a.io.soundData.toString(16)} vs 0x${b.io.soundData.toString(16)}`;
  }
  if (a.io.soundControl !== b.io.soundControl) {
    return `soundControl 0x${a.io.soundControl.toString(16)} vs 0x${b.io.soundControl.toString(16)}`;
  }
  if (a.io.soundTriggers !== b.io.soundTriggers) {
    return `soundTriggers ${a.io.soundTriggers} vs ${b.io.soundTriggers}`;
  }
  const d = firstStateDiff(a.dumpState(), b.dumpState(), (o) => a.stateOffsetToAddr(o));
  return d ? `RAM 0x${(d.addr ?? 0).toString(16)}: ${d.a} vs ${d.b}` : null;
}

// broken twins, each making an io difference the diff must catch.
function brokenNoOp() {} // never touches the sound ports -> no falling edge, no latch
function brokenWrongCommand(m) { // full sequence but the wrong command byte
  const { regs, mem } = m;
  mem.write8(0xd000, regs.a ^ 0xff); // wrong latch byte (always differs from A)
  const ctrl = mem.read8(0x83d9);
  mem.write8(0xd002, ctrl & 0xf7);
  mem.write8(0xd002, ctrl | 0x08);
}
function brokenNoEdge(m) { // latches the command but never pulses bit 3 low -> no /INT
  const { regs, mem } = m;
  mem.write8(0xd000, regs.a);
  const ctrl = mem.read8(0x83d9);
  mem.write8(0xd002, ctrl | 0x08); // stays high: no falling edge
}

test("CAPTURE: attract dispatches the sound issue; oracle == rewrite on every state", { skip }, () => {
  const entries = capture();
  assert.ok(entries.length > 0, "vacuous: loc_0794 was never dispatched in attract");
  for (const e of entries) assert.equal(ioDiff(loc_0794, e), null, "a captured machine diverged");
  console.log(`  CAPTURE: ${entries.length} dispatches, oracle == rewrite (io + RAM)`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const e = capture()[0];
  assert.ok(e, "no capture to test teeth against");
  assert.ok(ioDiff(brokenNoOp, e), "the no-op twin escaped");
  assert.ok(ioDiff(brokenWrongCommand, e), "the wrong-command twin escaped");
  assert.ok(ioDiff(brokenNoEdge, e), "the dropped-/INT-edge twin escaped");
  console.log("  TEETH: no-op, wrong-command, dropped-edge all caught");
});
