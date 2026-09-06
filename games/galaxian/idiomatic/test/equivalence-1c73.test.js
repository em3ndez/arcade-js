// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_1c73 — memory-equivalent to the frozen oracle at ROM 0x1c73.
 * Decodes three 2-bit input fields (IN1 bits 6-7, IN2 bits 0-1, IN2 bit 2) into text-descriptor indices
 * and paints each column into VRAM; then, unless IN0 bit 6 is asserted, seeds the screen-fill state (mode
 * flags, dwell tiers, VRAM cursor), clears the lamp/coin latch block, and silences the sound hardware.
 * The paints + the work-RAM init are in the state dump, so EQUAL asserts ramDiff==null on both the
 * full-init and the input-gated early-return paths. The latch/sound writes are board device latches NOT in
 * the dump, so their equivalence is asserted separately on the io device (like the silence leaf's own
 * test). Teeth: no-op, a paints-only twin (skips the init), a wrong-field-1 decode twin (repaints that
 * column from the wrong index), and a broken-silence twin (io).
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { drawInputTextColumnsAndSeedScreenFill as cand } from "../drawInputTextColumnsAndSeedScreenFill.js";
import { loc_1c73 as oracle } from "../../translated/loc_1c73.js";
import { drawTextColumnByIndex } from "../drawTextColumnByIndex.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const IN1 = 0x6800, IN2 = 0x7000; // read ports fold to io.in1 / io.in2
const M4006 = 0x4006, M401A = 0x401a, M4008 = 0x4008, M4009 = 0x4009;
const VRAM_LO = 0x400, VRAM_HI = 0x800; // videoRam window inside dumpState
const FOREIGN = 0x99;

// Seat SP-return, select fields via the input ports, and dirty the init cells + io latches foreign.
function seed(in0) {
  return craft((mem8, mm) => {
    mm.push16(0x9999);
    mm.io.inputAssert = null;
    mm.io.in0 = in0;   // bit 6 gates the state init
    mm.io.in1 = 0xc0;  // field 1 index = 3
    mm.io.in2 = 0x00;  // field 2 index = 4, field 3 index = 8
    mem8[M4006] = FOREIGN; mem8[M401A] = FOREIGN;
    mem8[M4008] = FOREIGN; mem8[M4009] = FOREIGN;
    mem8[0x400b] = FOREIGN; mem8[0x400c] = FOREIGN;
    mm.io.startLamp = [1, 1]; mm.io.coinLock = 1; mm.io.coinCounter = [1, 1];
    for (let i = 0; i < 4; i++) mm.io.soundLfo[i] = 9;
    for (let i = 0; i < 8; i++) mm.io.soundReg[i] = 9;
    mm.io.irqEnable = 1; mm.io.starsEnable = 1; mm.io.soundPitchVal = 0;
  });
}
const fullEntry = () => seed(0x00);   // IN0 bit 6 clear -> full init
const gatedEntry = () => seed(0x40);  // IN0 bit 6 set  -> paints only, then ret

// The latch/sound live-out is io device state (not in dumpState); snapshot it off the io device.
function ioAfter(fn, entry) {
  const m = entry.clone(); m.routines = STUBS; fn(m);
  return {
    lamp: [...m.io.startLamp], coinLock: m.io.coinLock, coinCtr: [...m.io.coinCounter],
    lfo: [...m.io.soundLfo], reg: [...m.io.soundReg],
    irq: m.io.irqEnable, stars: m.io.starsEnable, pitch: m.io.soundPitchVal,
  };
}
function vramChanged(entry) {
  const before = entry.clone().dumpState();
  const a = entry.clone(); a.routines = STUBS; oracle(a);
  const after = a.dumpState();
  for (let i = VRAM_LO; i < VRAM_HI; i++) if (before[i] !== after[i]) return true;
  return false;
}

test("EQUAL (crafted): loc_1c73 == oracle paints, seeds state, and quiesces the board", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, fullEntry()), null, "loc_1c73 diverged on RAM (paints + init)");
  assert.deepEqual(ioAfter(cand, fullEntry()), ioAfter(oracle, fullEntry()), "candidate/oracle io disagree");
  assert.ok(vramChanged(fullEntry()), "positive control: the paints changed no VRAM (vacuous)");
  const a = fullEntry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[M4006], 0, "positive control: mode flag not cleared");
  assert.equal(a.mem8[M401A], 2, "positive control: 0x401a not set to 2");
  assert.equal(a.mem8[M4008], 16, "positive control: dwell low byte");
  assert.equal(a.mem8[M4009], 48, "positive control: dwell high byte");
  assert.equal(a.mem.read16(0x400b), 0x5000, "positive control: VRAM cursor not seeded to base");
  const io = ioAfter(oracle, fullEntry());
  assert.deepEqual(io.lamp, [0, 0], "positive control: lamps not cleared");
  assert.equal(io.coinLock, 0, "positive control: coin lock not cleared");
  assert.deepEqual(io.lfo, [1, 1, 1, 1], "positive control: LFO not driven to 1");
  assert.deepEqual([...io.reg], [0, 0, 0, 0, 0, 0, 0, 0], "positive control: sound regs not cleared");
  assert.equal(io.irq, 0, "positive control: irq not disabled");
  assert.equal(io.stars, 0, "positive control: stars not disabled");
  assert.equal(io.pitch, 255, "positive control: pitch not driven high");
  console.log("  EQUAL: paints + state seed + latch clear + silence, == oracle");
});

test("EQUAL (crafted): loc_1c73 == oracle bails to paints-only when IN0 bit 6 is set", { skip }, () => {
  assert.equal(ramDiff(oracle, cand, gatedEntry()), null, "loc_1c73 diverged on the input-gated path");
  assert.deepEqual(ioAfter(cand, gatedEntry()), ioAfter(oracle, gatedEntry()), "gated io disagree");
  const a = gatedEntry(); a.routines = STUBS; oracle(a);
  assert.equal(a.mem8[M4006], FOREIGN, "positive control: gate did not skip the state init");
  assert.equal(ioAfter(oracle, gatedEntry()).irq, 1, "positive control: gate did not skip the silence");
  console.log("  EQUAL: IN0 bit 6 set -> paints only, init + silence skipped, == oracle");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const paintsOnly = (m) => {
    drawTextColumnByIndex(m, (m.mem8[IN1] >> 6) & 0x03);
    drawTextColumnByIndex(m, (m.mem8[IN2] & 0x03) + 4);
    drawTextColumnByIndex(m, ((m.mem8[IN2] >> 2) & 0x01) + 8);
  };
  const wrongField1 = (m) => { cand(m); drawTextColumnByIndex(m, m.mem8[IN1] & 0x03); }; // repaint from wrong index
  const brokenSilence = (m) => { cand(m); m.io.soundPitchVal = 0; };
  assert.ok(ramDiff(oracle, noOp, fullEntry()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, paintsOnly, fullEntry()), "the paints-only twin escaped (init)");
  assert.ok(ramDiff(oracle, wrongField1, fullEntry()), "the wrong-field-1 twin escaped (paint)");
  assert.notDeepEqual(ioAfter(brokenSilence, fullEntry()), ioAfter(oracle, fullEntry()), "broken-silence escaped (io)");
  console.log("  TEETH: no-op, paints-only, wrong-field-1 (RAM) + broken-silence (io) all caught");
});
