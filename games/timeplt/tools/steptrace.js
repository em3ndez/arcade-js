#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
/**
 * Record every DISTINCT (from-PC, to-PC, T-states) transition the translated layer
 * executes, to be checked against the ROM's instruction boundaries offline.
 *
 * state.bin is RAM at frame boundaries: it sees neither the PC nor F, so a wrong
 * T-state charge can diff clean for thousands of frames until the accumulated error
 * moves a write across a boundary and the diff blames the wrong frame entirely.
 *
 * Cheap because a transition is a property of the ROM, not the run. Says nothing about
 * paths not taken.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Machine } from "../machine.js";
import { buildRoutines } from "../routines.js";

const GAME_DIR = dirname(dirname(fileURLToPath(import.meta.url)));

function arg(name, dflt) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? dflt : process.argv[i + 1];
}

const frames = Number(arg("frames", 300));
const out = arg("out", join(GAME_DIR, "out", "steps.txt"));
const rom = new Uint8Array(readFileSync(arg("rom", join(GAME_DIR, "rom", "maincpu.bin"))));

const seen = new Set();
const origStep = Machine.prototype.step;
// `pcKnown` is false after a bare tick(), and after fireNmi's push the from-PC is the
// interrupted instruction's successor -- both are recorded as-is and sorted out by the
// audit, which knows 0x0066/11 is the NMI entry and that only a ret/dispatch may land
// anywhere.
Machine.prototype.step = function step(nextAddr, cycles) {
  seen.add(`${this.pc} ${nextAddr} ${cycles}`);
  return origStep.call(this, nextAddr, cycles);
};

const machine = new Machine(rom, buildRoutines());
machine.runFrames(frames);

const lines = [...seen]
  .map((s) => s.split(" ").map(Number))
  .sort((a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2])
  .map(([f, t, c]) => `${f.toString(16).padStart(4, "0")} ${t.toString(16).padStart(4, "0")} ${c}`);
writeFileSync(out, lines.join("\n") + "\n");

const err = machine.stoppedBy;
console.log(
  `${lines.length} distinct transitions over ${machine.frames.length} frame(s) -> ${out}` +
    (err ? `\n  (run stopped: ${err.message || err})` : ""),
);
