#!/usr/bin/env node
// SPDX-License-Identifier: GPL-3.0-only
// Tempest RENDER emitter -- the JS side of the pixel gate. Writes frames.rgb (480x640 RGB888, row-major,
// top-left origin, headerless, 921600 B/frame) + a frames.json index (per-frame sha256): the wire format the
// MAME golden is diffed against. Renders the IDIOMATIC layer through runIdiomaticIrqGame (the coroutine engine
// that ships) and boards/tempest/video.js (the byte-exact AVG->raster pipeline). The idiomatic layer paints at
// the vblank yield, one game-update per frame (~26.5Hz), so its timeline is COARSER than MAME's 60Hz AVI --
// the pixel suite reconverges drift-tolerant (nearest golden frame), never by a fixed offset.
//
// --pin <json> replays a captured POKEY RANDOM read sequence (TESTING ONLY, never shipped): Tempest's RNG is
// a hardware POKEY LFSR read directly at 0x60ca/0x60da reg 0x0a, which a clock-free layer freezes, so the
// attract DEMO forks without it. The pin makes the demo comparable; the deterministic attract screens
// (high-score/ranking) are byte-exact WITHOUT it. The pin's per-chip read count must match MAME's -- a
// drained/overrun queue is a code-path divergence signal, not just an RNG one (reported below).
//
// A run that stops early writes what it painted, says why, and exits NONZERO -- a short artifact must not read
// as clean.

import { createHash } from "node:crypto";
import { closeSync, mkdirSync, openSync, readFileSync, writeFileSync, writeSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { Machine, resolveAllIdiomatic } from "../machine.js";
import { runIdiomaticIrqGame } from "../../../core/frame-stepped.js";
import manifest from "../manifest.js";
import { SCREEN_W, SCREEN_H } from "../../../boards/tempest/video.js";
import { parseEmitArgs, hex4 } from "../../../tools/emit-core.js";

const GAME_DIR = dirname(dirname(fileURLToPath(import.meta.url))); // games/tempest
const BYTES_PER_FRAME = SCREEN_W * SCREEN_H * 3; // 480*640*3 = 921600

// Install the testing-only entropy pin: override the POKEY RANDOM read (reg 0x0a) to hand back MAME's captured
// value sequence per chip, in read order. Returns a live counters object so the caller can report drain/overrun.
function installPin(machine, pin) {
  const q = [pin.chip0 || [], pin.chip1 || []];
  const at = [0, 0];
  const over = [0, 0];
  const orig = machine.io.pokeyRead.bind(machine.io);
  machine.io.pokeyRead = (chip, reg, cycles) => {
    if ((reg & 0x0f) === 0x0a) {
      const c = chip === 0 ? 0 : 1;
      if (at[c] < q[c].length) return q[c][at[c]++];
      over[c]++;
      return 0xff;
    }
    return orig(chip, reg, cycles);
  };
  return { used: at, over, len: [q[0].length, q[1].length] };
}

async function main() {
  const args = parseEmitArgs(process.argv, {
    defaults: {
      rom: join(GAME_DIR, "rom", "maincpu.bin"),
      frames: 900,
      framesOut: join(GAME_DIR, "out", "render"),
    },
    extra: (flag, next, a) => {
      switch (flag) {
        case "--vectorrom": a.vectorrom = next(); return true;
        case "--avgprom": a.avgprom = next(); return true;
        case "--frames-out": a.framesOut = next(); return true;
        case "--pin": a.pin = next(); return true;
        default: return false;
      }
    },
  });
  if (!Number.isInteger(args.frames) || args.frames < 2) {
    throw new Error(`--frames expects an integer >= 2, got ${args.frames}`);
  }

  const maincpu = new Uint8Array(readFileSync(args.rom));
  const vectorrom = new Uint8Array(readFileSync(args.vectorrom ?? join(GAME_DIR, "rom", "vectorrom.bin")));
  const avgprom = new Uint8Array(readFileSync(args.avgprom ?? join(GAME_DIR, "rom", "avgprom.bin")));

  const overrides = await resolveAllIdiomatic();
  const machine = new Machine(maincpu, { overrides, vectorrom, avgprom });

  let pinCounters = null;
  if (args.pin) {
    pinCounters = installPin(machine, JSON.parse(readFileSync(args.pin, "utf8")));
  }

  const irq = manifest.convergence?.idiomatic?.irq;
  if (!irq) {
    throw new Error("manifest.convergence.idiomatic.irq is not declared -- required to render the idiomatic layer");
  }

  mkdirSync(args.framesOut, { recursive: true });
  const rgbPath = join(args.framesOut, "frames.rgb");
  const fd = openSync(rgbPath, "w");
  const hashes = [];

  const r = runIdiomaticIrqGame(machine, {
    bootAddr: irq.bootAddr,
    irqVblank: irq.irqVblank,
    maxFrames: args.frames,
    onFrame: (m, f) => {
      if (f === 0) return; // power-on, before the boot chain runs: no golden frame matches it
      const buf = m.renderFrame(); // AVG walk -> 480x640 RGB888 (persists last complete list, MAME behaviour)
      writeSync(fd, buf, 0, buf.length);
      hashes.push(createHash("sha256").update(buf).digest("hex"));
    },
  });
  closeSync(fd);

  writeFileSync(
    join(args.framesOut, "frames.json"),
    JSON.stringify(
      {
        width: SCREEN_W,
        height: SCREEN_H,
        bytes_per_frame: BYTES_PER_FRAME,
        pixel_format: "RGB888",
        origin: "top-left",
        count: hashes.length,
        frames: hashes.map((h, i) => ({ i, sha256: h })),
      },
      null,
      1,
    ) + "\n",
  );

  const distinct = new Set(hashes).size;
  console.log(
    `wrote ${hashes.length} frame(s) x ${BYTES_PER_FRAME} bytes -> ${rgbPath}\n` +
      `  ${r.frames} game-update(s); ${distinct} DISTINCT image(s)`,
  );

  if (pinCounters) {
    const { used, over, len } = pinCounters;
    console.log(
      `  PIN: chip0 ${used[0]}/${len[0]} read (overrun ${over[0]}), chip1 ${used[1]}/${len[1]} (overrun ${over[1]})`,
    );
    if (over[0] || over[1]) {
      console.error(
        "\nPIN OVERRUN: the idiomatic layer read RANDOM more than the captured sequence supplies -- capture a " +
          "longer pin or investigate a code-path divergence (the demo forks past the drain point).",
      );
      return 1;
    }
  }

  if (r.stopError) {
    const gap = /0x([0-9a-f]+)/.exec(r.stopError.message || "");
    console.error(
      `\nSTOP after ${hashes.length} painted frame(s)` +
        (gap ? ` at boot gap 0x${gap[1]}` : `: ${r.stopError.message || r.stopError}`) +
        ` (PC ${hex4(machine.pc)}).`,
    );
    return 1;
  }
  if (r.frames < args.frames) {
    console.error(`\nNOTE: asked for ${args.frames} frames, produced ${r.frames} (${r.stop}) -- investigate.`);
    return 1;
  }

  console.log(
    `\nCLEAN: painted ${hashes.length} frames (vblank yields) with no gap. ` +
      "Now pixel-diff frames.rgb against the MAME golden (drift-tolerant reconverge).",
  );
  return 0;
}

process.exit(await main());
