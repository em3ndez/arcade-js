-- SPDX-License-Identifier: GPL-3.0-only
-- Capture Tempest's POKEY RANDOM read sequence for the TESTING-ONLY entropy pin (games/tempest/tools/
-- pixel_suite.*): 0x60ca = POKEY1 RANDOM, 0x60da = POKEY2 RANDOM (reg 0x0a). Tempest's RNG is a hardware
-- POKEY LFSR read directly, which the clock-free idiomatic layer freezes -- so the attract demo forks
-- unless the JS side replays MAME's actual read VALUES in read order. Each read appends "<chip> <value>"
-- to RANDOM_OUT; the per-chip read COUNT is the pin's cross-check (a drain/overrun signals a code-path
-- divergence, not just an RNG one). Retain the taps in globals or the GC drops them.
local out = assert(io.open(os.getenv("RANDOM_OUT") or "random.txt", "w"))
out:setvbuf("no")
local mem = manager.machine.devices[":maincpu"].spaces["program"]
_G.__r0 = mem:install_read_tap(0x60ca, 0x60ca, "r0", function(o, d, m) out:write("0 " .. (d & 0xff) .. "\n") end)
_G.__r1 = mem:install_read_tap(0x60da, 0x60da, "r1", function(o, d, m) out:write("1 " .. (d & 0xff) .. "\n") end)
