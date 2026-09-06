// SPDX-License-Identifier: GPL-3.0-only
/**
 * loc_05a5 — memory-equivalent to the frozen oracle at ROM 0x05a5. Board/level-start setup: unpacks the
 * packed flag bitmap at 0x4180 into the flag block (0x4100), copies the 8 template bytes that follow it
 * (0x4190) into the template buffer (0x4218), clears 0x425f/0x4220/0x4018 (and the 0x7006/0x7007 flip
 * latches, which live off the state dump), bumps SEQUENCE_STATE (0x400a), arms dwell 0x4009=0x96, and
 * publishes pointer 0x0640 into the 0x4245 slot. Then, gated on the sound flag 0x4006 bit0: bit0 clear ->
 * no sound; else 0x400e bit0 set -> the paired-player burst (prologue param 3), clear -> a plain channel-5
 * prologue word (param 0) plus the standard burst. Live-out is work RAM (setup cells + the command queue);
 * the dispatch caller reads no registers back. Teeth: no-op, wrong-template, wrong-pointer, a queue
 * scribble, and a prologue-param swap. Plus an SP-seam tooth on the no-sound and inline paths.
 */
import test from "node:test";
import assert from "node:assert/strict";

import { craft, ramDiff, romsPresent, STUBS } from "./_bootSetup.js";
import { withOmittedRet } from "../../machine.js";
import { seamPlaceable } from "../../../../core/equivalence.js";
import { restoreFormationAndEnterPlaySubstate as cand } from "../restoreFormationAndEnterPlaySubstate.js";
import { loc_05a5 as oracle } from "../../translated/loc_05a5.js";

const skip = romsPresent() ? false : "ROM images are gitignored; none assembled";

const BITMAP = 0x4180;      // packed flag bitmap: 16 mask bytes then 8 template bytes
const FLAG_BLOCK = 0x4100;  // 128 one-byte-per-bit flags
const TEMPLATE = 0x4218;    // 8-byte template destination
const STATUS_425F = 0x425f, STATUS_4220 = 0x4220, DIR_4018 = 0x4018;
const SEQ = 0x400a, DWELL = 0x4009, CBPTR = 0x4245;
const SOUND_GATE = 0x4006, PAIRED = 0x400e;
const QHEAD = 0x40a0, QBASE = 0x4000, HEAD = 0xc0;
const Q = QBASE + HEAD;
const SENT = 0xaa;
const FLIP_X = 0x7006, FLIP_Y = 0x7007; // display-flip latches (io.setFlipX/Y), off the state dump
const flipAfter = (fn, e) => { const m = e.clone(); m.routines = STUBS; fn(m); return [m.mem.io.flipX, m.mem.io.flipY]; };

// Shared setup: seed the bitmap, pre-dirty every cell the routine writes, seed a known SEQUENCE_STATE.
function seedSetup(mem, mm) {
  mm.push16(0x9999);
  for (let i = 0; i < 16; i++) mem[BITMAP + i] = 0;
  mem[BITMAP + 0] = 0x03; // mask byte 0 bits 0,1 -> flag[0]=flag[1]=1
  for (let i = 0; i < 8; i++) mem[BITMAP + 16 + i] = (i + 1) * 0x11; // template payload 0x11..0x88
  for (let i = 0; i < 128; i++) mem[FLAG_BLOCK + i] = SENT;
  for (let i = 0; i < 8; i++) mem[TEMPLATE + i] = SENT;
  mem[STATUS_425F] = SENT; mem[STATUS_4220] = SENT; mem[DIR_4018] = SENT;
  mem[FLIP_X] = 1; mem[FLIP_Y] = 1; // seed the flip latches ON so the routine's clear is observable
  mem[SEQ] = 2; mem[DWELL] = SENT;
  mem[CBPTR] = SENT; mem[CBPTR + 1] = SENT;
}

// Arm the queue slots free from the floor upward so every append lands.
function armQueue(mem) {
  mem[QHEAD] = HEAD;
  for (let i = HEAD; i <= 0xff; i++) mem[QBASE + i] = 0xff;
}

// Sound gate clear: setup only, no cue.
const noSoundEntry = () => craft((mem, mm) => {
  seedSetup(mem, mm);
  mem[SOUND_GATE] &= ~1;
  armQueue(mem);
});
// Sound gate + paired flag set: prologue param 3 + burst.
const pairedEntry = () => craft((mem, mm) => {
  seedSetup(mem, mm);
  mem[SOUND_GATE] |= 1; mem[PAIRED] |= 1;
  armQueue(mem);
});
// Sound gate set, paired flag clear: prologue param 0 + burst.
const inlineEntry = () => craft((mem, mm) => {
  seedSetup(mem, mm);
  mem[SOUND_GATE] |= 1; mem[PAIRED] &= ~1;
  armQueue(mem);
});

test("EQUAL (crafted): loc_05a5 == oracle on the no-sound, paired, and inline paths (RAM)", { skip }, () => {
  for (const [name, e] of [["noSound", noSoundEntry], ["paired", pairedEntry], ["inline", inlineEntry]]) {
    assert.equal(ramDiff(oracle, cand, e()), null, `loc_05a5 diverged on the ${name} path`);
  }

  // Positive control: the setup block writes each cell to its expected value (no-sound path).
  const s = noSoundEntry(); s.routines = STUBS; oracle(s);
  assert.equal(s.mem8[FLAG_BLOCK + 0], 1, "control: flag[0] unpacked from mask bit 0");
  assert.equal(s.mem8[FLAG_BLOCK + 1], 1, "control: flag[1] unpacked from mask bit 1");
  assert.equal(s.mem8[FLAG_BLOCK + 2], 0, "control: flag[2] unpacked from mask bit 2");
  assert.equal(s.mem8[TEMPLATE + 0], 0x11, "control: template byte 0 copied");
  assert.equal(s.mem8[TEMPLATE + 7], 0x88, "control: template byte 7 copied");
  assert.equal(s.mem8[STATUS_425F], 0, "control: 0x425f cleared");
  assert.equal(s.mem8[STATUS_4220], 0, "control: 0x4220 cleared");
  assert.equal(s.mem8[DIR_4018], 0, "control: 0x4018 cleared");
  assert.equal(s.mem8[SEQ], 3, "control: SEQUENCE_STATE bumped 2->3");
  assert.equal(s.mem8[DWELL], 0x96, "control: dwell 0x4009 armed");
  assert.equal(s.mem8[CBPTR], 0x40, "control: pointer low byte");
  assert.equal(s.mem8[CBPTR + 1], 0x06, "control: pointer high byte");
  assert.equal(s.mem8[QHEAD], HEAD, "control: no-sound path leaves the write-head untouched");
  // io live-out: the display-flip latches (0x7006/0x7007, absent from dumpState) are cleared.
  assert.deepEqual(flipAfter(cand, noSoundEntry()), flipAfter(oracle, noSoundEntry()), "loc_05a5 diverged on the flip latches");
  assert.deepEqual(flipAfter(oracle, noSoundEntry()), [0, 0], "control: flip latches cleared");

  // Positive control: inline path queues (5,0)+(5,2)+(6,2)+(6,4)+(7,3)+(7,0); head 0xc0->0xcc.
  const inl = inlineEntry(); inl.routines = STUBS; oracle(inl);
  const wantInline = [0x05, 0x00, 0x05, 0x02, 0x06, 0x02, 0x06, 0x04, 0x07, 0x03, 0x07, 0x00];
  for (let i = 0; i < wantInline.length; i++) assert.equal(inl.mem8[Q + i], wantInline[i], `inline queued byte ${i}`);
  assert.equal(inl.mem8[QHEAD], 0xcc, "control: inline path advanced the write-head by twelve");

  // Positive control: paired path queues the prologue with param 3 instead of 0.
  const pr = pairedEntry(); pr.routines = STUBS; oracle(pr);
  assert.equal(pr.mem8[Q + 0], 0x05, "control: paired prologue channel");
  assert.equal(pr.mem8[Q + 1], 0x03, "control: paired prologue param 3");
  assert.equal(pr.mem8[QHEAD], 0xcc, "control: paired path advanced the write-head by twelve");
  console.log("  EQUAL: loc_05a5 == oracle (RAM): setup block + no-sound/paired/inline cue paths");
});

test("TEETH: broken twins are caught", { skip }, () => {
  const noOp = () => {};
  const wrongTemplate = (m) => { cand(m); m.mem8[TEMPLATE] = (m.mem8[TEMPLATE] + 1) & 0xff; };
  const wrongPointer = (m) => { cand(m); m.mem16[CBPTR] = 0; };
  const queueScribble = (m) => { cand(m); m.mem8[Q + 1] ^= 0xff; };      // corrupt a queued byte
  const wrongPrologueParam = (m) => { cand(m); m.mem8[Q + 1] = 0x00; };  // paired -> inline param

  assert.ok(ramDiff(oracle, noOp, inlineEntry()), "the no-op twin escaped");
  assert.ok(ramDiff(oracle, wrongTemplate, noSoundEntry()), "the wrong-template twin escaped");
  assert.ok(ramDiff(oracle, wrongPointer, noSoundEntry()), "the wrong-pointer twin escaped");
  assert.ok(ramDiff(oracle, queueScribble, inlineEntry()), "the queue-scribble twin escaped");
  assert.ok(ramDiff(oracle, wrongPrologueParam, pairedEntry()), "the prologue-param twin escaped");
  // io tooth: a twin that runs the routine but leaves the flip latches set -- RAM-identical (ramDiff==null),
  // caught only by observing the io latches.
  const skipFlipClear = (m) => { cand(m); m.mem.io.flipX = 1; m.mem.io.flipY = 1; };
  assert.notDeepEqual(flipAfter(skipFlipClear, noSoundEntry()), flipAfter(oracle, noSoundEntry()), "the skip-flip-clear twin escaped (io flip latches)");
  console.log("  TEETH: no-op, wrong-template, wrong-pointer, queue-scribble, prologue-param (RAM) + skip-flip-clear (io) all caught");
});

test("SP-SEAM TOOTH: the stack-neutral body places at the dispatch seam", { skip }, () => {
  for (const [name, e] of [["noSound", noSoundEntry], ["inline", inlineEntry]]) {
    const r = seamPlaceable(withOmittedRet, cand, 0x05a5, e());
    assert.equal(r.placeable, true, `${name}: seam refused the stack-neutral body: ${r.error}`);
  }
  const popping = (m) => { cand(m); m.push16(0x9999); };
  const rm = seamPlaceable(withOmittedRet, popping, 0x05a5, inlineEntry());
  assert.equal(rm.placeable, false, "the stack-adrift mutant placed at the seam (tooth has no teeth)");
  console.log("  SP-SEAM: stack-neutral body places on no-sound + inline; stack-adrift mutant refused");
});
