// SPDX-License-Identifier: GPL-3.0-only
// Time Pilot — game manifest, and the single source of truth for the ROM part list. Every
// hardware fact here is read from MAME src/mame/konami/timeplt.cpp -- ROM_START(timeplt),
// timeplt_state::main_map, the timeplt machine_config, and INPUT_PORTS_START(timeplt) with the
// KONAMI8 macros expanded from konamipt.h. The `keys` block is our own web-player binding.

export default {
  id: "timeplt",
  title: "Time Pilot",
  year: 1982,
  manufacturer: "Konami",
  orientation: "vertical",
  screen: { width: 256, height: 224, rot: 90 }, // MAME ROT90

  cpu: "z80",
  board: "timeplt",
  mameDriver: "timeplt.cpp",

  runtime: "translated",

  // MAME part filenames concatenated in address order into the flat images the engine loads;
  // sha256 verifies each. ROM bytes are copyrighted and never committed. Every part is
  // contiguous with the one before, so the ROM_START load addresses are the running totals.
  rom: {
    zip: "timeplt.zip",
    images: {
      maincpu: {
        parts: ["tm1", "tm2", "tm3"],
        size: 0x6000,
        sha256: "ec89258096bfcf64f5940f85cc58a67b89b6061834fb13f6829e88534a8e9066",
      },
      // A SECOND Z80 with its own program, unlike DK's i8035 sample player. Not modelled;
      // declared because it is a disassembly target of its own. MAME: "timeplt_audio:tpsound".
      tpsound: {
        parts: ["tm7"],
        size: 0x1000,
        sha256: "d98da26e5ae670504d48b610d1956907c17fd8ecb9e3f0192b010bcb351023e8",
      },
      tiles: {
        parts: ["tm6"],
        size: 0x2000,
        sha256: "c557f9c38a04c15c11c981708a59510d50f00e86bb920831595d41260584bf95",
      },
      sprites: {
        parts: ["tm4", "tm5"],
        size: 0x4000,
        sha256: "e92b2ffbe01ee8ede0f0a1df0ef5b3c31776a2ac140cd46959d65535006588c5",
      },
      // b4 and b5 are the palette PROMs, e9 the sprite lookup, e12 the char lookup.
      proms: {
        parts: ["timeplt.b4", "timeplt.b5", "timeplt.e9", "timeplt.e12"],
        size: 0x0240,
        sha256: "09aae834a5310925d8700fbbaececbcee7868177634bbcb4314df0b57f129a66",
      },
    },
  },

  // ALL BITS ARE ACTIVE LOW -- a pressed control clears its bit, so IN0/IN1/IN2 idle at 0xFF.
  // DSW0 also reads 0xFF, but DSW1 reads 0x4B: that is its default SETTINGS, not an idle-high
  // port (see the dips block). Bit assignments are KONAMI8_SYSTEM_10 and KONAMI8_MONO_8WAY.
  inputs: {
    ports: { in0: 0xc300, in1: 0xc320, in2: 0xc340 },
    actions: {
      left:   { port: 0xc320, bit: 0x01 },
      right:  { port: 0xc320, bit: 0x02 },
      up:     { port: 0xc320, bit: 0x04 },
      down:   { port: 0xc320, bit: 0x08 },
      fire:   { port: 0xc320, bit: 0x10 },
      coin:   { port: 0xc300, bit: 0x01 },
      coin2:  { port: 0xc300, bit: 0x02 },
      service:{ port: 0xc300, bit: 0x04 },
      start1: { port: 0xc300, bit: 0x08 },
      start2: { port: 0xc300, bit: 0x10 },
      // IN2 is the cocktail player-2 stick, same layout as IN1; nothing binds to it.
    },
    keys: {
      ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
      ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
      Space: "fire", KeyZ: "fire", KeyX: "fire",
      Digit5: "coin", KeyC: "coin", Digit1: "start1", Digit2: "start2",
    },
  },

  // pollPCs -- THIS BOARD HAS NO VBLANK POLL. All game logic runs inside the NMI service and the
  // foreground is a command-ring drain spinning on an empty ring for ever; 0x0B93 is that drain's
  // top and the only foreground control-flow event there is, so it is the yield by ELIMINATION.
  // It costs something: the drain gets one pass per NMI instead of a frame's worth, so the ring
  // backs up where the cycle-driven engine never lets it, and a pair posted onto a cell not yet
  // consumed is dropped by the ROM. Sound for a TRANSPARENCY gate, where both runs are the same
  // engine and only their difference is read; not a model to converge against MAME with.
  //
  // stateExclude.stack -- SP is seated once at boot (`ld sp,0xb000`) and never re-seated, so the
  // stack is the top of work RAM and grows down. Its floor is the DEEPEST SP a tape-driven run
  // reaches, NOT the game-state ceiling far below: the bytes between are written by nothing, and
  // a leaking SP walks down into them FIRST, so excluding them would hide the very fault the
  // seam exists to prevent.
  convergence: {
    pollPCs: [0x0b93],
    stateExclude: { stack: [0xafd6, 0xb000] }, // [start, end) -- the measured stack, nothing more
  },

  // MEASURED from MAME under -noreadconfig. DSW1's 0x4B decomposes exactly as the driver's
  // table says: 3 lives (0x03), upright (0x04 clear), bonus at 10000/50000 (0x08),
  // difficulty 4 (0x40), demo sounds on (0x80 clear).
  dipswitches: { dsw0: 0xff, dsw1: 0x4b },
};
