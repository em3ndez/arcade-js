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

  // §4 decompile complete: every reachable routine is idiomatic JS (idiomatic_gate total 0). Enables the
  // §4-end cleanup regime (comment_gate drops its density/reference rules for this game's idiomatic/**).
  idiomaticComplete: true,

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

  entropyPin: null, // §4 MEASURED — nothing to pin: pooyan has no timing-seeded RNG. Attract work RAM is
  // byte-identical JS-vs-MAME every frame (only the dead stack scratch forks), and the cycle-driven JS
  // reproduces MAME byte-for-byte on identical inputs through a full board clear; enemy spawns derive from
  // deterministic counters/tables (ANIM_FRAME_COUNTER&7, spawn-tally). The idiomatic-vs-MAME gameplay
  // divergence is cycle-free PHASE drift (a few timer cells), not entropy, so a seed pin is a no-op.

  // Frame model (MAME-grounded): pooyan's main loop loc_020f FREE-RUNS with no vblank busy-wait — the NMI
  // (0x066d) is the sole per-frame heartbeat. Per real vblank the CPU drains the WHOLE display command ring
  // (0x88c0..0x88ff) then idles in the per-frame worker (0x0254); MAME's ring occupancy is 0 every frame.
  // So the frame boundary is the worker/ring-idle point, NOT every loop iteration: the poll/yield PC is
  // 0x021c (the return right after the worker 0x0254), which is reached ONLY on the worker path. Command
  // dispatches ret to 0x020f, so polling 0x020f would fire one NMI PER COMMAND and drain the ring one
  // command/frame — a credit-screen backlog then leaves stale attract tiles on the playfield deep into
  // gameplay (fails verifyPlayfieldTileChecksumOnce's tile checksum). Polling 0x021c drains the ring within a frame, matching
  // MAME. Attract convergence is unchanged (empty ring); the idiomatic arm mirrors it in mainLoop (yield
  // only on the worker iteration). (History: 0x020f was attract-only-validated; the gameplay tape exposed
  // the per-command drain — see ARCADE2 seam log.)
  convergence: {
    idiomatic: { nmiReturnPC: 0x021c },
    pollPCs: [0x021c],
    stateExclude: { stack: [0x8fc0, 0x9000] }, // stack scratch (SP inits 0x9000); matches names.js STACK_SCRATCH — gameplay call chains push deeper than attract's 0x8fd8
  },

  // Audio: clips model (shared timeplt_audio, record/replay). TODO §5 after recording.
  audio: {
    map: "audio/sounds.js",
    samples: "audio/samples",
  },

  // TODO §2 — MEASURE from MAME -noreadconfig. DSW1 default ~0x7b; DSW0 = KONAMI_COINAGE idle 0xff.
  dipswitches: { dsw0: 0xff, dsw1: 0x7b },
};
