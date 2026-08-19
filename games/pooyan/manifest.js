// SPDX-License-Identifier: GPL-3.0-only
// Grounded in mame-src/src/mame/konami/pooyan.cpp (ROM_START, INPUT_PORTS, GAME macro) + the fork plan.
// convergence.* / entropyPin / dsw1 carry provisional values until disasm + MAME measurement (§2/§3/§4).

export default {
  id: "pooyan",
  title: "Pooyan",
  year: 1982,
  manufacturer: "Konami",
  orientation: "vertical",
  screen: { width: 256, height: 224, rot: 90 }, // MAME ROT90

  cpu: "z80",
  board: "pooyan",
  mameDriver: "pooyan.cpp",

  runtime: "idiomatic",

  rom: {
    zip: "pooyan.zip",
    images: {
      maincpu: {
        parts: ["1.4a", "2.5a", "3.6a", "4.7a"], // 4x8KB contiguous 0x0000-0x7fff
        size: 0x8000,
        sha256: "dff1bf18c7b98800bd6460247cef96103e8e56dba6e611419a01f3eba60cea56",
      },
      // 2nd Z80 (timeplt_audio:tpsound) — not modelled (audio = record/replay); a disassembly target.
      tpsound: {
        parts: ["xx.7a", "xx.8a"],
        size: 0x2000,
        sha256: "8e2b8ac79af7ed62fedd258bdf43b6baadff5e8946d97d308824bd90cc7c6e3e",
      },
      tiles: {
        parts: ["8.10g", "7.9g"], // 4bpp chars
        size: 0x2000,
        sha256: "3edfb5fe433b6e854d1b49f42cbf1ee1ecd6312152e67b9ddd0d410f1aadf601",
      },
      sprites: {
        parts: ["6.9a", "5.8a"], // 4bpp sprites
        size: 0x2000,
        sha256: "9a432ede9a728c6de1d660ac4c9d1fbf0fa01e3af58e5190b82b1242d8317f54",
      },
      // ROM_LOAD order pr1/pr3/pr2: pr1@0 palette 32B, pr3@0x20 char lut 256B, pr2@0x120 sprite lut 256B.
      proms: {
        parts: ["pooyan.pr1", "pooyan.pr3", "pooyan.pr2"],
        size: 0x220,
        sha256: "aa607ca91778acfcb765d03cf633823b8d4e2fdce7bfbd397a79dddb8a70326c",
      },
    },
  },

  // ALL BITS ACTIVE LOW (idle high). IN0 coins/start @0xa080, IN1 P1 @0xa0a0, IN2 P2-cocktail @0xa0c0.
  // 2-way UP/DOWN stick + one shoot button — NO left/right.
  inputs: {
    ports: { in0: 0xa080, in1: 0xa0a0, in2: 0xa0c0 },
    actions: {
      up:      { port: 0xa0a0, bit: 0x04 },
      down:    { port: 0xa0a0, bit: 0x08 },
      fire:    { port: 0xa0a0, bit: 0x10 },
      coin:    { port: 0xa080, bit: 0x01 },
      coin2:   { port: 0xa080, bit: 0x02 },
      service: { port: 0xa080, bit: 0x04 },
      start1:  { port: 0xa080, bit: 0x08 },
      start2:  { port: 0xa080, bit: 0x10 },
    },
    keys: {
      ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
      Space: "fire", KeyZ: "fire", KeyX: "fire",
      Digit5: "coin", KeyC: "coin", Digit1: "start1", Digit2: "start2",
    },
  },

  entropyPin: null, // TODO §4 — measure the spin-counter fork set

  convergence: {
    idiomatic: { nmiReturnPC: 0x0000 }, // TODO — main-loop top the vblank NMI returns to (NMI vector 0x0066)
    pollPCs: [0x0000], // TODO
    stateExclude: { stack: [0x0000, 0x0000] }, // TODO — the MEASURED Z80 stack window
  },

  // Audio: clips model (shared timeplt_audio, record/replay). TODO §5 after recording.
  audio: {
    map: "audio/sounds.js",
    samples: "audio/samples",
  },

  // TODO §2 — MEASURE from MAME -noreadconfig. DSW1 default ~0x7b; DSW0 = KONAMI_COINAGE idle 0xff.
  dipswitches: { dsw0: 0xff, dsw1: 0x7b },
};
