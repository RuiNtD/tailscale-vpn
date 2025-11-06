# Tailscale-VPN

Small CLI tool and JavaScript library for suggesting and connecting to Tailscale exit nodes

Requires [Deno](https://deno.com/)

## Usage

```
> tsvpn connect
Connecting to: my-exit-node.tailandscales.com.

> tsvpn connect --mullvad
Connecting to: us-chi-wg-307.mullvad.ts.net.
🌐 USA: Chicago, IL

> tsvpn connect USA
> tsvpn connect USA "Dallas, TX"
> tsvpn connect US-DAL
> tsvpn disconnect

> tsvpn status
Disconnected
```
