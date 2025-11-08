#!/usr/bin/env -S deno run -A

import { parseArgs } from "@std/cli/parse-args";
import $ from "@david/dax";
import * as TS from "./tailscale.ts";

async function suggestNode(mullvad: boolean, country: string, city: string) {
  return mullvad
    ? await TS.suggestMullvadNode(country, city)
    : await TS.suggestExitNode(country, city);
}

function logNode(prefix: string, node: TS.Peer) {
  $.logStep(prefix, node.DNSName);
  if (!node.Online) $.logError("❌ Exit node is offline", "");
  if (!node.ExitNodeOption)
    $.logError("❌ Device is not running an exit node", "");
  logNodeLoc(node);
}
function logNodeLoc({ Location: loc }: TS.Peer) {
  if (loc) $.logLight(`🌐 ${loc.Country}: ${loc.City}`);
}

function parseConnectArgs() {
  const { _, mullvad } = parseArgs(Deno.args.slice(1), {
    boolean: ["mullvad"],
    string: ["_"],
    collect: ["_"],
  });
  return { country: _[0], city: _[1], mullvad };
}

async function connect(node: TS.ExitNode | undefined) {
  assertNode(node);
  logNode("Connecting to:", node);
  await TS.setExitNode(node);
}

async function disconnect() {
  $.logStep("Disconnecting");
  await TS.setExitNode(undefined);
}

function assertNode(
  node: TS.ExitNode | undefined
): asserts node is TS.ExitNode {
  if (node) return;
  $.logError("No nodes found", "");
  Deno.exit();
}

switch (Deno.args[0]) {
  case "connect": {
    const { country, city, mullvad } = parseConnectArgs();
    const node = await suggestNode(mullvad, country, city);
    await connect(node);
    break;
  }
  case "suggest": {
    const { country, city, mullvad } = parseConnectArgs();
    const node = await suggestNode(mullvad, country, city);
    assertNode(node);

    console.log(node.DNSName);
    logNodeLoc(node);
    break;
  }
  case "disconnect":
    await disconnect();
    break;
  case "toggle": {
    const current = await TS.getCurrentExitNode();
    if (current) await disconnect();
    else {
      const { country, city, mullvad } = parseConnectArgs();
      const node = await suggestNode(mullvad, country, city);
      await connect(node);
    }
    break;
  }
  case "status": {
    const arg = Deno.args[1];
    const node = await TS.getCurrentExitNode();
    if (arg == "plain") {
      if (node) console.log(node.DNSName);
      else console.log("Not connected");
    } else if (arg == "json") console.log(JSON.stringify(node, null, 2));
    else {
      if (node) logNode("Connected to:", node);
      else $.logLight("Not connected");
    }
    break;
  }
  default:
    $.log("Usage:");
    $.log("  tsvpn connect [--mullvad] [<country>] [<city>]");
    $.log("  tsvpn disconnect");
    $.log("  tsvpn toggle [--mullvad] [<country>] [<city>]");
    $.log();
    $.log("  tsvpn suggest [--mullvad] [<country>] [<city>]");
    $.log("  tsvpn status [plain|json]");
    Deno.exit(1);
}
