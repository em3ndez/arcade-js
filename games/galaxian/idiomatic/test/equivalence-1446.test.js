// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1446 — crafted-entry equivalence vs the frozen free-slot finder.
 * Scans four descriptor slots high->low for one whose two guard bytes are both zero; on a hit it seeds
 * that slot and enqueues its spawn word, otherwise it does nothing. Live-outs: memory — the seeded slot,
 * the consumed trigger flag, and the command word (all in ramDiff); and register HL — the trigger pointer
 * comes back unchanged (the caller reads its low byte), checked directly. Two paths: a hit on the third
 * slot, and no free slot. Positive controls prove the hit seeds and the miss is a genuine no-op; teeth
 * show a no-op, a slot scribble, and an HL-clobber twin each diverge.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { spawnIntoFreeDescriptorSlot as cand } from "../spawnIntoFreeDescriptorSlot.js";
import { loc_1446 as oracle } from "../../translated/loc_1446.js";

const S0 = 0x4390, S1 = 0x4370, S2 = 0x4350, S3 = 0x4330; // the four slots, scan order
const TRIGGER = 0x4165, SPAWN = 0x25;                      // HL / C at entry; low byte 0x65 = source index
const HEAD = 0x40a0, SLOT = 0x40c0;
const F_ACTIVE = 0, F_PHASE = 2, F_SPAWN = 6, F_SOURCE = 7;
const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

// A hit on the third slot: the first two occupied, the third free, the rest irrelevant.
const hit = () => craft((mem, mm) => {
  mm.regs.hl = TRIGGER; mm.regs.c = SPAWN;
  mem[S0] = 1; mem[S1] = 1; mem[S2] = 0; mem[S2 + 1] = 0;
  mem[S2 + F_PHASE] = 7; // nonzero, so the phase clear is observable
  mem[TRIGGER] = 1;      // armed, so the consume is observable
  mem[HEAD] = 0xc0; mem[SLOT] = 0x80; // free queue head
  mm.push16(0x9999);
});
// No free slot: every slot's first guard byte is set.
const noSlot = () => craft((mem, mm) => {
  mm.regs.hl = TRIGGER; mm.regs.c = SPAWN;
  mem[S0] = 1; mem[S1] = 1; mem[S2] = 1; mem[S3] = 1;
  mem[TRIGGER] = 1;
  mm.push16(0x9999);
});

// HL is a register live-out (not in the state dump); read it off the machine directly.
function hlAfter(fn, entry) { const m = entry.clone(); m.routines = STUBS; fn(m); return m.regs.hl; }
const runOracle = (e) => { e.routines = STUBS; oracle(e); return e; };

test("EQUAL (crafted): loc_1446 == oracle on the hit and the miss", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, hit()), null, "hit path diverged in RAM");
  assert.equal(hlAfter(cand, hit()), hlAfter(oracle, hit()), "hit: HL live-out diverged");
  assert.equal(ramDiff(oracle, cand, noSlot()), null, "miss path diverged in RAM");
  assert.equal(hlAfter(cand, noSlot()), hlAfter(oracle, noSlot()), "miss: HL live-out diverged");
  console.log("  EQUAL: loc_1446 == oracle (RAM + HL) on hit and miss");
});

test("positive controls: the hit seeds, the miss is a no-op", { skip }, () => {
  const a = runOracle(hit());
  assert.equal(a.mem8[TRIGGER], 0, "trigger not consumed");
  assert.equal(a.mem8[S2 + F_ACTIVE], 1, "third slot not activated");
  assert.equal(a.mem8[S2 + F_PHASE], 0, "phase not cleared");
  assert.equal(a.mem8[S2 + F_SPAWN], SPAWN, "spawn code not stored");
  assert.equal(a.mem8[S2 + F_SOURCE], TRIGGER & 0xff, "source index not stored");
  assert.equal(a.mem8[SLOT], 1, "spawn word hi (type 1) not queued");
  assert.equal(a.mem8[SLOT + 1], TRIGGER & 0xff, "spawn word lo (source) not queued");
  assert.equal(a.mem8[HEAD], 0xc2, "write-head not advanced");
  assert.equal(hlAfter(oracle, hit()), TRIGGER, "hit: HL not preserved");

  const noOp = () => {};
  assert.equal(ramDiff(oracle, noOp, noSlot()), null, "miss path wrote memory");
  assert.equal(hlAfter(oracle, noSlot()), TRIGGER, "miss: HL not preserved");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const scribble = (m) => { cand(m); m.mem8[S2 + 16] ^= 0xff; };
  const clobberHl = (m) => { cand(m); m.regs.hl = (m.regs.hl + 1) & 0xffff; };
  assert.ok(ramDiff(oracle, noOp, hit()), "no-op escaped (hit)");
  assert.ok(ramDiff(oracle, scribble, hit()), "scribble escaped (RAM teeth)");
  assert.notEqual(hlAfter(clobberHl, hit()), hlAfter(oracle, hit()), "HL-clobber escaped (reg teeth)");
  console.log("  TEETH: no-op, scribble (RAM), HL-clobber (reg) all caught");
});
