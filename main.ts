#!/usr/bin/env -S deno run -A

import { parseArgs } from "@std/cli/parse-args";
import $ from "@david/dax";
import * as TS from "./tailscale.ts";

switch (Deno.args[0]) {
  case "connect": {
    const args = parseArgs(Deno.args.slice(1), {
      boolean: ["mullvad"],
      string: ["_"],
      collect: ["_"],
    });
    const arg1 = args._[0];
    const arg2 = args._[1];

    const node = args.mullvad
      ? await TS.suggestMullvadNode(arg1, arg2)
      : await TS.suggestExitNode(arg1, arg2);
    if (!node) {
      $.logError("No results found", "");
      Deno.exit(1);
    }

    $.logStep("Connecting to:", node?.DNSName);
    if (node.Location)
      $.logLight(`🌐 ${node.Location.Country}: ${node.Location.City}`);
    await TS.setExitNode(node);
    break;
  }
  case "suggest": {
    const args = parseArgs(Deno.args.slice(1), {
      boolean: ["mullvad"],
      string: ["_"],
      collect: ["_"],
    });
    const arg1 = args._[0];
    const arg2 = args._[1];

    const node = args.mullvad
      ? await TS.suggestMullvadNode(arg1, arg2)
      : await TS.suggestExitNode(arg1, arg2);
    if (!node) {
      $.logError("No results found", "");
      Deno.exit(1);
    }

    console.log(node?.DNSName);
    if (node.Location)
      $.logLight(`🌐 ${node.Location.Country}: ${node.Location.City}`);
    break;
  }
  case "disconnect":
    await TS.setExitNode(undefined);
    break;
  case "status": {
    const arg = Deno.args[1];
    const node = await TS.getCurrentExitNode();
    if (arg == "plain") {
      if (node) console.log(node.DNSName);
      else console.log("Not connected");
    } else if (arg == "json") console.log(JSON.stringify(node, null, 2));
    else {
      if (node) {
        $.logStep("Connected to:", node.DNSName);
        if (!node.Online) $.logError("❌ Exit node is offline", "");
        if (!node.ExitNodeOption)
          $.logError("❌ Device is not running an exit node", "");
        if (node.Location)
          $.logLight(`🌐 ${node.Location.Country}: ${node.Location.City}`);
      } else $.logLight("Not connected");
    }
    break;
  }
  default:
    $.log("Usage:");
    $.log("  tsvpn connect [--mullvad] [<country>] [<city>]");
    $.log("  tsvpn suggest [--mullvad] [<country>] [<city>]");
    $.log("  tsvpn disconnect");
    $.log("  tsvpn status [plain|json]");
    Deno.exit(1);
}
