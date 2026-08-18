// SPDX-License-Identifier: GPL-3.0-only
// Frogger (Konami parent `frogger`) — Galaxian/Scramble family (MAME galaxian/galaxian.cpp). Fields
// flagged ★ TODO need a MAME golden boot trace; do NOT guess them.

export default {
  id: "frogger",
  title: "Frogger",
  year: 1981,
  manufacturer: "Konami",
  orientation: "vertical",
  screen: { width: 256, height: 224, rot: 90 },

  cpu: "z80",
  board: "frogger",
  mameDriver: "galaxian.cpp",

  runtime: "idiomatic",

  // Port finished (cruft=0) -> CLEANUP phase: comment_gate allows verbose idiomatic comments. docs/comment-gate.md
  idiomaticComplete: true,

  // ROM assembly is game-local (games/frogger/tools/build-rom.mjs) for two transforms: maincpu PADDED
  // 0x3000->0x4000 with 0x00 (memory.js requires a 0x4000 image), and gfx plane1 (.606) D0<->D1 swapped
  // (decode_frogger_gfx@8705: bitswap<8>(b,7,6,5,4,3,2,0,1)). size/sha256 are of the FINAL assembled image.
  rom: {
    zip: "frogger.zip", // MAME set name; assembler also reads a loose set dir
    images: {
      maincpu: {
        parts: ["frogger.26", "frogger.27", "frsm3.7"],
        size: 0x4000,
        sha256: "f8c0a2ef4105769c627b7bbf13d0844ada8bbe43c00d177eb90dd395d1e3a1e5",
      },
      gfx: {
        parts: ["frogger.607", "frogger.606"],
        size: 0x1000,
        sha256: "2718b9527bbd9bfdb5af4b35275b34dd8660d529bc1f4eaeb336ddd6589a238a",
      },
      proms: {
        parts: ["pr-91.6l"], // 32-byte color PROM; no LUT PROMs
        size: 0x20,
        sha256: "db633922b57b4e033df7b8a7fc710c942bdf486821d3895ca413337ade532667",
      },
      // Audio ROMs (.608/609/610) are NOT assembled: the audio CPU is modelled by record/replay of the
      // sound-command surface, recorded from a running romset later (as timeplt does).
    },
  },

  // ALL INPUT BITS ACTIVE LOW; NO separate DSW port (dip bits INTERLEAVED into IN1/IN2, idle values in
  // io.js). Bits are the PARENT `frogger` INPUT_PORTS_START (cocktail P2 dupes NOT bound); 4-way, no fire.
  inputs: {
    ports: { in0: 0xe000, in1: 0xe002, in2: 0xe004 },
    // UP/DOWN on IN2 (b4/b6), LEFT/RIGHT on IN0 (b5/b4); COIN1/COIN2/SERVICE1 on IN0; START1/2 on IN1.
    actions: {
      up:      { port: 0xe004, bit: 0x10 },
      down:    { port: 0xe004, bit: 0x40 },
      left:    { port: 0xe000, bit: 0x20 },
      right:   { port: 0xe000, bit: 0x10 },
      coin:    { port: 0xe000, bit: 0x80 },
      coin2:   { port: 0xe000, bit: 0x40 },
      service: { port: 0xe000, bit: 0x04 },
      start1:  { port: 0xe002, bit: 0x80 },
      start2:  { port: 0xe002, bit: 0x40 },
    },
    keys: {
      ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
      ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
      Digit5: "coin", KeyC: "coin", Digit1: "start1", Digit2: "start2",
    },
  },

  // ★ TODO (BLOCKED on a MAME golden boot): spin-RNG cells unknown until traced; leave unset, pin to 0 both
  // sides once identified (core/entropy-pin.js, [[entropy-pinning-strategy]]).
  entropyPin: null,

  // Idiomatic go-live (runIdiomaticGame). nmiReturnPC = the pace tail 0x0368, where control sits at the
  // vblank yield; the foreground FREE-RUNS (no poll), so pollPCs mirrors it only for manifest shape.
  // stateExclude.stack [start,end) is the measured Z80 stack below SP=0x8800 (deepest push 0x87e2).
  convergence: {
    idiomatic: { nmiReturnPC: 0x0368 },
    pollPCs: [0x0368],
    stateExclude: { stack: [0x87e0, 0x8800] },
  },
};
