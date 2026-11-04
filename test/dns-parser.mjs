// DNS parser unit test — exercises scripts/dns.sh --parse-hosts-xml against
// two fixture files:
//   1. The real 2026-11-04 Namecheap getHosts XML (lowercase <host Type=>)
//   2. The legacy XML shape (capital <Host RecordType=>) seen in earlier API versions
//
// Run: npm test  (node --import ./test/register.mjs test/dns-parser.mjs)
// No Namecheap credentials needed — parse-only mode, no API calls.

import assert from "node:assert/strict";
import { execSync } from "node:child_process";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const dnsScript = join(here, "..", "scripts", "dns.sh");

// Real Namecheap getHosts XML captured 2026-11-04 — the shape that caused two
// zone nukes.  Element is lowercase <host>; record type is in Type= (not RecordType=).
// All 13 records restored after the 2026-11-04 incident.
const LIVE_FIXTURE_XML = `\
<?xml version="1.0" encoding="utf-8"?>
<ApiResponse Status="OK" xmlns="http://api.namecheap.com/xml.response">
  <CommandResponse Type="namecheap.domains.dns.getHosts">
    <DomainDNSGetHostsResult Domain="shanaghy.com" EmailType="NONE" IsUsingOurDNS="true">
      <host HostId="1001" Name="@" Type="A" Address="185.199.108.153" MXPref="10" TTL="1800" AssociatedAppTitle="" FriendlyName="" IsActive="true" IsDDNSEnabled="false" />
      <host HostId="1002" Name="@" Type="A" Address="185.199.109.153" MXPref="10" TTL="1800" AssociatedAppTitle="" FriendlyName="" IsActive="true" IsDDNSEnabled="false" />
      <host HostId="1003" Name="@" Type="A" Address="185.199.110.153" MXPref="10" TTL="1800" AssociatedAppTitle="" FriendlyName="" IsActive="true" IsDDNSEnabled="false" />
      <host HostId="1004" Name="@" Type="A" Address="185.199.111.153" MXPref="10" TTL="1800" AssociatedAppTitle="" FriendlyName="" IsActive="true" IsDDNSEnabled="false" />
      <host HostId="1005" Name="@" Type="AAAA" Address="2606:50c0:8000::153" MXPref="10" TTL="1800" AssociatedAppTitle="" FriendlyName="" IsActive="true" IsDDNSEnabled="false" />
      <host HostId="1006" Name="@" Type="AAAA" Address="2606:50c0:8001::153" MXPref="10" TTL="1800" AssociatedAppTitle="" FriendlyName="" IsActive="true" IsDDNSEnabled="false" />
      <host HostId="1007" Name="@" Type="AAAA" Address="2606:50c0:8002::153" MXPref="10" TTL="1800" AssociatedAppTitle="" FriendlyName="" IsActive="true" IsDDNSEnabled="false" />
      <host HostId="1008" Name="@" Type="AAAA" Address="2606:50c0:8003::153" MXPref="10" TTL="1800" AssociatedAppTitle="" FriendlyName="" IsActive="true" IsDDNSEnabled="false" />
      <host HostId="1009" Name="www" Type="CNAME" Address="declanshanaghy.github.io" MXPref="10" TTL="1800" AssociatedAppTitle="" FriendlyName="" IsActive="true" IsDDNSEnabled="false" />
      <host HostId="1010" Name="odins-throne" Type="A" Address="136.81.14.206" MXPref="10" TTL="1800" AssociatedAppTitle="" FriendlyName="" IsActive="true" IsDDNSEnabled="false" />
      <host HostId="1011" Name="gke" Type="A" Address="136.81.14.206" MXPref="10" TTL="1800" AssociatedAppTitle="" FriendlyName="" IsActive="true" IsDDNSEnabled="false" />
      <host HostId="1012" Name="mytruthfinder" Type="A" Address="8.228.230.29" MXPref="10" TTL="1800" AssociatedAppTitle="" FriendlyName="" IsActive="true" IsDDNSEnabled="false" />
      <host HostId="1013" Name="_acme-challenge.mytruthfinder" Type="CNAME" Address="6d3974d2-1234-5678-abcd-ef0123456789.authorize.certificatemanager.goog" MXPref="10" TTL="1800" AssociatedAppTitle="" FriendlyName="" IsActive="true" IsDDNSEnabled="false" />
    </DomainDNSGetHostsResult>
  </CommandResponse>
</ApiResponse>`;

// Legacy XML shape: capital <Host> element with RecordType= attribute.
// This is the shape the script originally expected.
const LEGACY_FIXTURE_XML = `\
<?xml version="1.0" encoding="utf-8"?>
<ApiResponse Status="OK" xmlns="http://api.namecheap.com/xml.response">
  <CommandResponse Type="namecheap.domains.dns.getHosts">
    <DomainDNSGetHostsResult Domain="shanaghy.com" EmailType="NONE" IsUsingOurDNS="true">
      <Host HostId="2001" Name="@" RecordType="A" Address="185.199.108.153" MXPref="10" TTL="1800" IsActive="true" />
      <Host HostId="2002" Name="www" RecordType="CNAME" Address="declanshanaghy.github.io" MXPref="10" TTL="1800" IsActive="true" />
      <Host HostId="2003" Name="odins-throne" RecordType="A" Address="136.81.14.206" MXPref="10" TTL="1800" IsActive="true" />
    </DomainDNSGetHostsResult>
  </CommandResponse>
</ApiResponse>`;

function parseFixture(xml) {
  const dir = mkdtempSync(join(tmpdir(), "dns-parser-test-"));
  const file = join(dir, "fixture.xml");
  writeFileSync(file, xml, "utf8");
  const out = execSync(`bash ${dnsScript} --parse-hosts-xml ${file}`, { encoding: "utf8" });
  return out.trim().split("\n").filter(Boolean).map((line) => {
    const [name, type, address, ttl] = line.split("|");
    return { name, type, address, ttl };
  });
}

// ── Live XML shape (2026-11-04 real capture) ─────────────────────────────────
const liveRecords = parseFixture(LIVE_FIXTURE_XML);

assert.equal(liveRecords.length, 13, `live XML: expected 13 records, got ${liveRecords.length}`);

// Apex A records
const apexA = liveRecords.filter((r) => r.name === "@" && r.type === "A");
assert.equal(apexA.length, 4, "live XML: 4 apex A records");
assert.ok(apexA.some((r) => r.address === "185.199.108.153"), "live XML: apex A 185.199.108.153");
assert.ok(apexA.some((r) => r.address === "185.199.111.153"), "live XML: apex A 185.199.111.153");

// Apex AAAA records
const apexAAAA = liveRecords.filter((r) => r.name === "@" && r.type === "AAAA");
assert.equal(apexAAAA.length, 4, "live XML: 4 apex AAAA records");
assert.ok(apexAAAA.some((r) => r.address === "2606:50c0:8000::153"), "live XML: apex AAAA 2606:50c0:8000::153");
assert.ok(apexAAAA.some((r) => r.address === "2606:50c0:8003::153"), "live XML: apex AAAA 2606:50c0:8003::153");

// www CNAME
const www = liveRecords.find((r) => r.name === "www");
assert.ok(www, "live XML: www record present");
assert.equal(www.type, "CNAME", "live XML: www is CNAME");
assert.equal(www.address, "declanshanaghy.github.io", "live XML: www CNAME target");

// odins-throne A
const odin = liveRecords.find((r) => r.name === "odins-throne");
assert.ok(odin, "live XML: odins-throne record present");
assert.equal(odin.type, "A", "live XML: odins-throne is A");
assert.equal(odin.address, "136.81.14.206", "live XML: odins-throne address");

// gke A
const gke = liveRecords.find((r) => r.name === "gke");
assert.ok(gke, "live XML: gke record present");
assert.equal(gke.type, "A", "live XML: gke is A");
assert.equal(gke.address, "136.81.14.206", "live XML: gke address");

// mytruthfinder A
const mtf = liveRecords.find((r) => r.name === "mytruthfinder");
assert.ok(mtf, "live XML: mytruthfinder record present");
assert.equal(mtf.type, "A", "live XML: mytruthfinder is A");
assert.equal(mtf.address, "8.228.230.29", "live XML: mytruthfinder address");

// _acme-challenge CNAME
const acme = liveRecords.find((r) => r.name === "_acme-challenge.mytruthfinder");
assert.ok(acme, "live XML: _acme-challenge.mytruthfinder record present");
assert.equal(acme.type, "CNAME", "live XML: _acme-challenge.mytruthfinder is CNAME");
assert.ok(acme.address.includes("authorize.certificatemanager.goog"), "live XML: acme CNAME target");

// All records have TTL
for (const r of liveRecords) {
  assert.ok(r.ttl && r.ttl.length > 0, `live XML: record ${r.name}/${r.type} has TTL`);
}

// ── Legacy XML shape (<Host RecordType=>) ────────────────────────────────────
const legacyRecords = parseFixture(LEGACY_FIXTURE_XML);

assert.equal(legacyRecords.length, 3, `legacy XML: expected 3 records, got ${legacyRecords.length}`);

const legacyApexA = legacyRecords.find((r) => r.name === "@" && r.type === "A");
assert.ok(legacyApexA, "legacy XML: apex A record present");
assert.equal(legacyApexA.address, "185.199.108.153", "legacy XML: apex A address");

const legacyWww = legacyRecords.find((r) => r.name === "www");
assert.ok(legacyWww, "legacy XML: www record present");
assert.equal(legacyWww.type, "CNAME", "legacy XML: www is CNAME");

const legacyOdin = legacyRecords.find((r) => r.name === "odins-throne");
assert.ok(legacyOdin, "legacy XML: odins-throne record present");
assert.equal(legacyOdin.address, "136.81.14.206", "legacy XML: odins-throne address");

// ── Empty zone: no host elements → empty output (no abort, no error) ─────────
{
  const dir = mkdtempSync(join(tmpdir(), "dns-parser-test-"));
  const file = join(dir, "empty.xml");
  writeFileSync(file, `<DomainDNSGetHostsResult Domain="shanaghy.com" EmailType="NONE" IsUsingOurDNS="true"></DomainDNSGetHostsResult>`, "utf8");
  const out = execSync(`bash ${dnsScript} --parse-hosts-xml ${file}`, { encoding: "utf8" });
  assert.equal(out.trim(), "", "empty zone XML produces empty parse output (no error)");
}

console.log("DNS PARSER PASS — live XML (13 records, all types), legacy XML (3 records, RecordType= form), empty zone");
process.exit(0);
