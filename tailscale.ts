import $ from "@david/dax";
import * as z from "zod";
import { isString, sample } from "@es-toolkit/es-toolkit";
import pMemoize from "p-memoize";

const TSExitNodeLocation = z.looseObject(
  {
    Country: z.string(),
    CountryCode: z.string(),
    City: z.string(),
    CityCode: z.string(),
    Priority: z.number(),
  },
  "Not a location-based exit node"
);
const TSPeer = z.looseObject({
  ID: z.string(),
  PublicKey: z.string(),
  HostName: z.string(),
  DNSName: z.string(),
  TailscaleIPs: z.string().array(),
  Tags: z.string().array().optional(),
  Online: z.boolean(),
  ExitNode: z.boolean(),
  ExitNodeOption: z.boolean(),
  Location: TSExitNodeLocation.optional(),
});
type TSPeer = z.infer<typeof TSPeer>;

const TSExitNode = TSPeer.extend({
  ExitNodeOption: z.literal(true, "Not an exit node"),
});
type TSExitNode = z.infer<typeof TSExitNode>;

const TSMullvadNode = TSExitNode.extend({
  Location: TSExitNodeLocation,
});
type TSMullvadNode = z.infer<typeof TSMullvadNode>;

const TSStatus = z.object({
  ExitNodeStatus: z
    .object({
      ID: z.string(),
      Online: z.boolean(),
    })
    .optional(),
  MagicDNSSuffix: z.string(),
  Peer: z.record(z.string(), TSPeer),
});
type TSStatus = z.infer<typeof TSStatus>;

async function _getStatus(): Promise<TSStatus> {
  return TSStatus.parse(await $`tailscale status --json`.json());
}
export const getStatus = pMemoize(_getStatus);

// Can be not a TSExitNode if peer is no longer running as an exit node
export async function getCurrentExitNode(): Promise<TSPeer | undefined> {
  const status = (await getStatus()).ExitNodeStatus;
  if (!status) return;

  return await getPeer(status.ID);
}

async function _getSuggestedExitNode(): Promise<TSExitNode | undefined> {
  const lines = await $`tailscale exit-node suggest`.lines();
  const match = lines[0].match(/: (.*)/);
  if (!match) return;

  return TSExitNode.parse(await getPeer(match[1]));
}
export const getSuggestedExitNode = pMemoize(_getSuggestedExitNode);

export async function getPeers(): Promise<TSPeer[]> {
  return Object.values((await getStatus()).Peer);
}
export async function getPeer(name: string): Promise<TSPeer | undefined> {
  const dnsSuffix = (await getStatus()).MagicDNSSuffix;
  const peers = await getPeers();
  const namelc = name.toLowerCase();
  return peers.find(
    (v) =>
      v.ID == name ||
      v.PublicKey == name ||
      v.DNSName == namelc ||
      v.DNSName == `${namelc}.` ||
      v.DNSName == `${namelc}.${dnsSuffix}.` ||
      v.TailscaleIPs.includes(name)
  );
}

export async function getExitNodes(): Promise<TSExitNode[]> {
  const peers = await getPeers();
  return peers.filter((v): v is TSExitNode => TSExitNode.safeParse(v).success);
}

export async function getMullvadNodes(
  country?: string,
  city?: string
): Promise<TSMullvadNode[]> {
  const nodes = (await getPeers()).filter(
    (v): v is TSMullvadNode => TSMullvadNode.safeParse(v).success
  );
  if (!country) return nodes;

  if (city)
    return nodes.filter(
      ({ Location: loc }) =>
        (country == loc.Country || country == loc.CountryCode) &&
        (city == loc.City || city == loc.CityCode)
    );
  return nodes.filter(
    ({ Location: loc }) =>
      country == `${loc.CountryCode}-${loc.CityCode}` ||
      country == loc.Country ||
      country == loc.CountryCode
  );
}

export async function suggestMullvadNode(
  country?: string,
  city?: string
): Promise<TSMullvadNode | undefined> {
  let mvNodes = (await getMullvadNodes(country, city))
    .filter((v) => v.Online)
    .sort((a, b) => b.Location.Priority - a.Location.Priority);
  if (!mvNodes.length) return;

  const topPriority = mvNodes[0].Location.Priority;
  mvNodes = mvNodes.filter((v) => v.Location.Priority == topPriority);

  const current = mvNodes.find((v) => v.ExitNode);
  if (current) return current;

  // TODO: As far as I can tell, Tailscale's GUI just picks a random node
  // out of the highest priority nodes. This should be updated if there's a
  // better method.
  return sample(mvNodes);
}

export async function suggestExitNode(
  arg1?: string,
  city?: string
): Promise<TSExitNode | undefined> {
  if (!arg1) return await getSuggestedExitNode();

  const node = await getPeer(arg1);
  if (node) return TSExitNode.parse(node);

  return await suggestMullvadNode(arg1, city);
}

export async function setExitNode(node: TSExitNode | string | undefined) {
  const name = isString(node) ? node : node?.DNSName;
  if (name) await $`tailscale set --exit-node=${name}`;
  else await $`tailscale set --exit-node=`;
}
