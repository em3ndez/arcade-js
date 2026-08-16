// SPDX-License-Identifier: GPL-3.0-only
/**
 * driveExtraFrogHopAcross — memory-equivalent to the frozen oracle at ROM 0x236D.
 * GATE: crafted-entry. The extra-frog driver returns on the suppress/hold gates, ticks a running spawn
 * dwell, else re-arms the dwell, advances the phase, and dispatches the ROM script's frame code. From a
 * captured post-boot state the gate pokes the gate cells, the dwell, and the phase index to hit every
 * ROM code: LEFT(0x02)/RIGHT(0x05)/UP(0x08)/DOWN(0x0b) hop-begin dispatch, the 0x0e no-op frame, and the
 * 0xff reset. Live-out memory-only; RAM compared, stack masked. Teeth: no-op, dropped dwell reload,
 * wrong dispatch; positive control the dispatch re-arms the dwell (0x8299 0->0x30).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { romsPresent, craft, ramDiff, PLAY_FLAG, FROG_X, FROG_Y } from "./_frogHop.js";
import { driveExtraFrogHopAcross as cand } from "../driveExtraFrogHopAcross.js";
import { loc_236d as oracle } from "../../translated/loc_236d.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";
const SUPPRESS = 0x826c, HOLD = 0x8004, DWELL = 0x8299, PHASE = 0x829a, TWO_P = 0x825b;

// A frog position + PLAY_FLAG so the dispatched hop-begin handlers are exercised.
const base = (mem) => { mem[PLAY_FLAG] = 1; mem[FROG_X] = 0x50; mem[FROG_Y] = 0x50; };
// The ROM script table (0x2E68) read at offset phase+1: phase 0->RIGHT, 1->LEFT, 4->UP, 0x1c->DOWN,
// 0x0c->no-op, 0x1f->reset. Dwell 0 forces the advance path.
const disp = (phase) => craft((mem) => { base(mem); mem[DWELL] = 0; mem[PHASE] = phase; });

test("EQUAL (crafted): driveExtraFrogHopAcross == oracle on gates/dwell/every dispatch code", { skip }, () => {
  const cases = [
    ["suppress", craft((mem) => { base(mem); mem[SUPPRESS] = 1; })],
    ["hold", craft((mem) => { base(mem); mem[HOLD] = 1; })],
    ["dwell-running", craft((mem) => { base(mem); mem[DWELL] = 5; })],
    ["LEFT 0x02", disp(0x01)], ["RIGHT 0x05", disp(0x00)], ["UP 0x08", disp(0x04)],
    ["DOWN 0x0b", disp(0x1c)], ["no-op 0x0e", disp(0x0c)],
    ["reset 0xff", craft((mem) => { base(mem); mem[DWELL] = 0; mem[PHASE] = 0x1f; mem[TWO_P] = 0x33; })],
  ];
  for (const [name, mk] of cases) assert.equal(ramDiff(oracle, cand, mk), null, `the ${name} path diverged`);

  const e = disp(0x01); const before = e.mem8[DWELL]; const a = e.clone(); oracle(a);
  assert.notEqual(a.mem8[DWELL], before, "dispatch not exercised: dwell never re-armed");
  console.log(`  EQUAL: gates/dwell/LEFT/RIGHT/UP/DOWN/no-op/reset; dispatch re-armed dwell ${before}->${a.mem8[DWELL]}`);
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const noReload = (m) => { const v = m.mem8[PHASE]; cand(m); m.mem8[DWELL] = 0; m.mem8[PHASE] = v; };
  const wrongDispatch = (m) => { m.mem8[DWELL] = 0x30; m.mem8[PHASE] = (m.mem8[PHASE] + 1) & 0xff; };
  assert.ok(ramDiff(oracle, noOp, disp(0x04)), "no-op twin escaped");
  assert.ok(ramDiff(oracle, noReload, disp(0x0c)), "dropped-reload twin escaped");
  assert.ok(ramDiff(oracle, wrongDispatch, disp(0x04)), "wrong-dispatch twin escaped");
  console.log("  TEETH: no-op, dropped-dwell-reload, wrong-dispatch all caught");
});
