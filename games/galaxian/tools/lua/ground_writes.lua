-- SPDX-License-Identifier: GPL-3.0-only
-- Grounding write-tap: record every write into the whole RAM+MMIO write space (0x4000-0x7fff) with the
-- writing PC, so a routine's role-defining write can be observed on the real machine (stage-B
-- [code]->[seen]). The full span is load-bearing for ROUTINE grounding: work RAM 0x4000-0x43ff holds the
-- cells, but VRAM 0x5000, OBJRAM 0x5800 and the sound/control latches 0x6000-0x7fff are where RENDERER and
-- PORT-writer routines leave their role-defining marks -- a work-RAM-only tap misreads every such producer
-- as a writeless register-helper. CURPC on a write tap is the NEXT instruction. Output CSV:
-- curpc,addr,value.  Env: GROUND_OUT.
local out = io.open(os.getenv("GROUND_OUT") or "ground_writes.csv", "w")
out:setvbuf("no"); out:write("curpc,addr,value\n")
local cpu = manager.machine.devices[":maincpu"]
local prog = cpu.spaces["program"]
-- Retain the subscription in a global: a collected MAME tap handle unsubscribes silently.
_G.__ground_tap = prog:install_write_tap(0x4000, 0x7fff, "groundw", function(offset, data, mask)
  out:write(string.format("%04x,%04x,%02x\n", cpu.state["CURPC"].value, offset, data))
end)
