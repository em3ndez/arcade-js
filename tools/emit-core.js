// SPDX-License-Identifier: GPL-3.0-only
/**
 * Shared machinery for the per-game `games/<game>/tools/emit.js` validation-artifact
 * emitters. This is the ONE copy of everything that is not game-specific: the
 * `--rom`/`--frames`/`--state-out`/`--poke`/`--input` argument grammar, the
 * state.bin/state.json writer, and the sha256/distinct helpers. Each game's emit.js
 * is a thin wrapper that supplies its Machine + board (STATE_DUMP_SIZE + region map)
 * and any genuinely game-specific extras (a boot-gap report, a post-boot fingerprint,
 * a video/pixel-diff dump). The point is that this core lives in exactly one place, so
 * there is nothing to keep in sync between games.
 *
 * The shared honesty contract every emit run keeps: a SHORT run (fewer frames than
 * asked, or a stop) writes the frames it DID produce, prints why, and the caller
 * exits NONZERO — a short artifact must never exit 0 and read as complete.
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const sha256 = (buf) => createHash("sha256").update(Buffer.from(buf)).digest("hex");
export const hex4 = (v) => `0x${(v & 0xffff).toString(16).padStart(4, "0")}`;

/**
 * The `--poke ADDR=VAL@FRAME[:hold[N]|once]` / `--input PORT=BITS@FRAME[:hold[N]|once]`
 * grammar, shared with lua/poke_ram.lua and the MAME lua tapes. `hold` (default for
 * poke) rewrites every frame from FRAME on; `holdN` holds N frames then releases (the
 * game's own code takes over); `once` (default for input) is a single write / 1-frame pulse.
 */
export const POKE_INPUT_SPEC =
  /^(0x[0-9a-fA-F]+|\d+)=(0x[0-9a-fA-F]+|\d+)@(\d+)(?::(hold|once)(\d+)?)?$/;

function parseTimed(spec, kind, defaultMode) {
  const mt = spec.match(POKE_INPUT_SPEC);
  if (!mt) throw new Error(`--${kind} expects ADDR=VAL@FRAME[:hold[N]|once], got ${spec}`);
  const mode = mt[4] || defaultMode;
  if (mode === "once" && mt[5]) {
    throw new Error(`--${kind}: "once" takes no count — use hold${mt[5]}, got ${spec}`);
  }
  return {
    a: Number(mt[1]) & 0xffff,
    v: Number(mt[2]) & 0xff,
    frame: Number(mt[3]),
    dur: mode === "once" ? 1 : mt[5] ? Number(mt[5]) : null,
  };
}

/**
 * Parse the shared emit flags. `opts.defaults` overrides the built-in defaults
 * (e.g. a game whose emit-out dir is fixed). `opts.extra(flag, next, args)` lets a
 * game consume its own flags — return true if it handled `flag`, else the flag is
 * rejected. `next()` returns the following argv token (advancing the cursor).
 */
export function parseEmitArgs(argv, { defaults = {}, extra } = {}) {
  const args = { rom: "rom/maincpu.bin", frames: 1, stateOut: null, pokes: [], inputs: [], ...defaults };
  for (let i = 2; i < argv.length; i++) {
    const flag = argv[i];
    const next = () => argv[++i];
    switch (flag) {
      case "--rom": args.rom = next(); break;
      case "--frames": {
        const v = next();
        if (v !== "all" && !Number.isInteger(Number(v))) {
          throw new Error(`--frames expects an integer or "all", got ${v}`);
        }
        args.frames = v === "all" ? "all" : Number(v);
        break;
      }
      case "--state-out": args.stateOut = next(); break;
      case "--poke": {
        const p = parseTimed(next(), "poke", "hold");
        args.pokes.push({ addr: p.a, val: p.v, frame: p.frame, dur: p.dur });
        break;
      }
      case "--input": {
        const p = parseTimed(next(), "input", "once");
        args.inputs.push({ port: p.a, bits: p.v, frame: p.frame, dur: p.dur });
        break;
      }
      default:
        if (extra && extra(flag, next, args)) break;
        throw new Error(`unknown argument: ${flag}`);
    }
  }
  return args;
}

/**
 * Write the per-frame state artifact: state.bin (frames concatenated) + state.json
 * (metadata + per-frame sha256). `regions` is the board's `[{name,start,len}]` map and
 * `stateDumpSize` its bytes-per-frame — both from `boards/<game>/memory.js`. Returns the
 * byte length written.
 */
export function writeStateArtifact(dir, frames, { stateDumpSize, regions }) {
  mkdirSync(dir, { recursive: true });
  const bin = Buffer.concat(frames.map((f) => Buffer.from(f)));
  writeFileSync(join(dir, "state.bin"), bin);
  writeFileSync(
    join(dir, "state.json"),
    JSON.stringify(
      {
        bytes_per_frame: stateDumpSize,
        count: frames.length,
        regions,
        frames: frames.map((f, i) => ({ i, sha256: sha256(f) })),
      },
      null,
      2,
    ) + "\n",
  );
  return bin.length;
}

/** Count of distinct frames — a repetition-inflated frame count vs the real coverage. */
export const distinctCount = (frames) => new Set(frames.map((f) => sha256(f))).size;
