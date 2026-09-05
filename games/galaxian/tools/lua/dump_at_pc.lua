-- SPDX-License-Identifier: GPL-3.0-only
-- Galaxian PC-EXACT state capture: a state that exists only PARTWAY through a frame is invisible to
-- frame-boundary sampling, and some of them matter. `space:install_read_tap` works WITHOUT -debug and
-- fires when the byte is READ; tap ONE address and gate on CURPC (a tap also sees DATA reads, and this
-- ROM's boot reads bytes before most routines run). Same 2304-byte format as dump_state.lua. META carries
-- the register file AT THE TAP; a ONE-SHOT snapshot, no pair. Env: PC_TARGET (default 0x0000, reset entry),
-- STATE_OUT, PC_META, CONFIG_OUT.

local cpu = manager.machine.devices[":maincpu"]
local sp = cpu.spaces["program"]
local target = tonumber(os.getenv("PC_TARGET") or "0x0000")

-- Machine CONFIGURATION on EVERY capture path (see dump_state.lua for why galaxian has no standalone DSW;
-- dsw0=IN2@0x7000, dsw1=IN1@0x6800). All sampled AT SCRIPT LOAD: dips as MAME resolved them, the ROM byte
-- proving the image loaded, reg_* as the Z80 RESET state -- NOT the tapped-PC regs.
local cfgf = io.open(os.getenv("CONFIG_OUT") or "config.txt", "w")
if cfgf then
  cfgf:setvbuf("no")
  cfgf:write(string.format("dsw0=0x%02X\ndsw1=0x%02X\ncontrol_rom0000=0x%02X\n",
    sp:read_u8(0x7000), sp:read_u8(0x6800), sp:read_u8(0x0000)))
  for _, rn in ipairs({"AF","BC","DE","HL","IX","IY","SP"}) do
    local ok, v = pcall(function() return cpu.state[rn].value end)
    if ok and v ~= nil then cfgf:write(string.format("reg_%s=0x%04X\n", rn, v)) end
  end
  cfgf:close()
end

local out = assert(io.open(os.getenv("STATE_OUT") or "state_at_pc.bin", "wb"))
out:setvbuf("no")
local meta = io.open(os.getenv("PC_META") or "state_at_pc.txt", "w")
if meta then meta:setvbuf("no") end

-- Mirrors hardware.json "stateRegions" AND boards/galaxian/memory.js dumpState() order.
local REGIONS = {
  { 0x4000, 0x43FF, "ram" },
  { 0x5000, 0x53FF, "vram" },
  { 0x5800, 0x58FF, "objram" }
}

_G.__pc_done = false
_G.__pc_tap = sp:install_read_tap(target, target, "pc_exact", function(offset, data, mask)
  -- CURPC IS LOAD-BEARING: the boot reads ROM bytes, so for many addresses the FIRST tap hit is a data
  -- read whose state would be captured instead of the routine's opcode fetch.
  if cpu.state["CURPC"].value ~= target then return data end
  -- First opcode fetch only; an entry reached every frame would emit thousands.
  if _G.__pc_done then return data end
  _G.__pc_done = true

  local parts = {}
  for _, r in ipairs(REGIONS) do
    for a = r[1], r[2] do
      parts[#parts + 1] = string.char(sp:read_u8(a))
    end
  end
  out:write(table.concat(parts))

  if meta then
    local secs = manager.machine.time:as_double()
    meta:write(string.format(
      "pc=0x%04X\nopcode_byte=0x%02X\nseconds=%.9f\ncycles=%.0f\n",
      target, data, secs, secs * 3072000))
    -- Registers AS OF THIS FETCH, read inside the tap -- the config.txt copy is only the reset state.
    for _, rn in ipairs({ "AF", "BC", "DE", "HL", "IX", "IY", "SP" }) do
      local ok, v = pcall(function() return cpu.state[rn].value end)
      if ok and v ~= nil then meta:write(string.format("reg_%s=0x%04X\n", rn, v)) end
    end
  end
  return data
end)
