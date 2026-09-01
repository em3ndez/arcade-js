// SPDX-License-Identifier: GPL-3.0-only
// Grounded in mame-src/src/mame/midw8080/mw8080bw.cpp (ROM_START(invaders), invaders_state::invaders,
// GAMEL macro) + mw8080bw.h. inputs.actions bits / convergence.* / entropyPin are PROVISIONAL until the
// §2 empirical input-bit probe + §3 disasm + boot-first MAME measurement.

export default {
  id: "invaders",
  title: "Space Invaders",
  year: 1978,
  manufacturer: "Taito / Midway",
  orientation: "vertical",
  screen: { width: 256, height: 224, rot: 270 }, // MAME ROT270 (mw8080bw.cpp:3305 GAMEL invaders)

  cpu: "8080", // Intel 8080 -- core/cpu/8080.js (ALU/register model)
  board: "invaders",
  mameDriver: "mw8080bw.cpp",

  runtime: "idiomatic", // born-live on the generator engine; translated fallback until routines land
  idiomaticComplete: false, // NEW game -- §3/§4 in progress

  rom: {
    zip: "invaders.zip",
    images: {
      // 4x2KB program ROM, loaded h/g/f/e at 0x0000/0x0800/0x1000/0x1800 (mw8080bw.cpp ROM_START).
      // sha256 is of the concatenation in that order (games/invaders/rom/maincpu.bin), SHA1-verified per chip.
      maincpu: {
        parts: ["invaders.h", "invaders.g", "invaders.f", "invaders.e"],
        size: 0x2000,
        sha256: "7446e0994117596de5206519e693f8875ff3455e0be121d5cb975c3bcc224c4e",
      },
      // No graphics ROMs (1bpp bitmap in RAM) and no sound ROM (discrete/samples audio) -- unlike the
      // Konami boards, invaders has only the program ROM.
    },
  },

  // 8080 PORT space (IN/OUT), ACTIVE HIGH (pressed bit reads 1). Ports 0/1/2 read via io.portIn.
  // ★ action bits PROVISIONAL (standard Space Invaders layout) -- confirm empirically per runbook §2
  // (press each bit, diff vs a no-input baseline) before relying on them.
  inputs: {
    ports: { in0: 0, in1: 1, in2: 2 },
    // Bits + polarity pinned from INPUT_PORTS(invaders) in mw8080bw.cpp. coin is ACTIVE-LOW (see io.js);
    // start/controls active-high. Verified by boot+gameplay running gap-free through the emit engine.
    actions: {
      coin:   { port: 1, bit: 0x01, activeLow: true }, // IPT_COIN1
      start2: { port: 1, bit: 0x02 }, // IPT_START2
      start1: { port: 1, bit: 0x04 }, // IPT_START1
      fire:   { port: 1, bit: 0x10 }, // P1 button 1 (IN1 control bits)
      left:   { port: 1, bit: 0x20 }, // P1 left
      right:  { port: 1, bit: 0x40 }, // P1 right
      // P2 controls mirror onto IN2 control bits; DIPs (lives/bonus/coinage) also on IN2.
    },
    keys: {
      ArrowLeft: "left",
      ArrowRight: "right",
      " ": "fire",
      "5": "coin",
      "1": "start1",
      "2": "start2",
    },
  },

  // ★ PROVISIONAL. The 8080 has NO NMI -- invaders uses two RST interrupts/frame (RST1 0x08 mid, RST2 0x10
  // vblank). The single-NMI convergence contract does not map cleanly; the idiomatic-path 2-RST design (§4)
  // settles what the worker needs here. Left provisional so runtime:"idiomatic" is not yet worker-served.
  convergence: {
    idiomatic: {
      // nmiReturnPC: <fill at §4 -- the main-loop PC the vblank RST2 returns to>
    },
  },

  // ★ PROVISIONAL -- the boot-time entropy/seed cell to pin for a deterministic diff (find in §3).
  entropyPin: null,
};
