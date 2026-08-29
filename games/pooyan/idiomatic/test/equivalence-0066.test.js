// SPDX-License-Identifier: GPL-3.0-only
/**
 * Memory-equivalence for loc_0066 (ROM 0x0066, Pooyan) — the Z80 NMI vector, a bare jump to the vblank
 * service routine loc_066d. The oracle steps + m.call(0x066d); the module delegates directly. Both run a
 * whole NMI frame, so (as in equivalence-066d) the entry is a booted mid-attract clone captured from the
 * generator engine, not a raw power-on one; on it the two produce identical RAM (−stack).
 *
 * Run: node --test games/pooyan/idiomatic/test/equivalence-0066.test.js
 */

import nodeTest from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";

import { loc_0066 as oracle } from "../../translated/loc_0066.js";
import { loc_0066 } from "../loc_0066.js";
import { Machine, resolveAllIdiomatic } from "../../machine.js";
import { runIdiomaticGame } from "../../../../core/frame-stepped.js";
import { firstStateDiff } from "../../../../core/equivalence.js";
import { STACK_SCRATCH } from "../names.js";
import manifest from "../../manifest.js";

const ROM_DIR = new URL("../../rom/", import.meta.url);
const ROM_PRESENT = existsSync(new URL("maincpu.bin", ROM_DIR));
const ROM = ROM_PRESENT ? new Uint8Array(readFileSync(new URL("maincpu.bin", ROM_DIR))) : null;
const test = ROM_PRESENT ? nodeTest : (name, fn) => nodeTest(name, { skip: "skipped: ROM not built" }, fn);

const nmiReturnPC = manifest.convergence.idiomatic.nmiReturnPC;
const AT = 90;
const SP0 = 0x8fe0;
const RET = 0xfffc;
const inDeadStack = (addr) => addr != null && addr >= STACK_SCRATCH.lo && addr < STACK_SCRATCH.hi;

let SNAP = null;
if (ROM_PRESENT) {
  const overrides = await resolveAllIdiomatic();
  const boot = new Machine(ROM, { overrides });
  runIdiomaticGame(boot, {
    bootAddr: 0x0000, nmiReturnPC, maxFrames: AT + 1,
    onFrame: (m, f) => { if (f === AT) SNAP = m.clone(); },
  });
}
function forNmi() {
  const m = SNAP.clone(); m.regs.sp = SP0; m.mem.write16(SP0, RET); return m;
}

test("EQUAL: booted clone — module == oracle in RAM (−stack)", () => {
  assert.ok(SNAP, "boot reached the capture frame");
  const o = forNmi();
  const c = forNmi();
  oracle(o);
  loc_0066(c);
  const d = firstStateDiff(o.dumpState(), c.dumpState(), (off) => o.stateOffsetToAddr(off), inDeadStack);
  assert.equal(d, null, d && `RAM diff at 0x${(d.addr ?? 0).toString(16)}: oracle=${d.a} module=${d.b}`);
  console.log("  EQUAL booted clone: NMI-vector delegation, RAM identical");
});
