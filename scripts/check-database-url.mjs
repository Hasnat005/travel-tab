import "dotenv/config";
import dotenv from "dotenv";

// Load `.env.local` if present (Next.js style), then `.env`.
dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ quiet: true });

const candidates = [
  ["DATABASE_MIGRATION_URL", process.env.DATABASE_MIGRATION_URL],
  ["DATABASE_DIRECT_URL", process.env.DATABASE_DIRECT_URL],
  ["DATABASE_URL", process.env.DATABASE_URL],
];

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

let any = false;
for (const [name, rawMaybe] of candidates) {
  const raw = rawMaybe ?? "";
  if (!raw) continue;
  any = true;

  try {
    const u = new URL(raw);
    const port = u.port;

    const hasUsername = Boolean(u.username);
    const hasPassword = Boolean(u.password);

    console.log(`${name} parsed OK (sanitized):`);
    console.log({
      protocol: u.protocol,
      hostname: u.hostname,
      port: port || "(none)",
      pathname: u.pathname,
      hasUsername,
      hasPassword,
      hasQuery: Boolean(u.search),
    });

    if (port && !/^\d+$/.test(port)) {
      fail(`Port is not numeric: ${port}`);
    }
  } catch (err) {
    fail(`${name} failed to parse: ${err instanceof Error ? err.message : String(err)}`);

    // Extra hints without leaking credentials.
    const startsWithPostgres =
      raw.startsWith("postgres://") || raw.startsWith("postgresql://");

    // Best-effort host/port extraction without using URL parsing.
    // postgres://user:pass@host:port/db?query
    const afterScheme = raw.split("://")[1] ?? "";
    const authorityPlus = afterScheme.split("/")[0] ?? "";
    const hostPortPlus = authorityPlus.includes("@")
      ? authorityPlus.split("@").slice(-1)[0]
      : authorityPlus;
    const hostPort = hostPortPlus;
    const lastColon = hostPort.lastIndexOf(":");
    const host = lastColon >= 0 ? hostPort.slice(0, lastColon) : hostPort;
    const portCandidate = lastColon >= 0 ? hostPort.slice(lastColon + 1) : "";

    console.log({
      startsWithPostgres,
      length: raw.length,
      hasWhitespace: /\s/.test(raw),
      hasBrackets: /[\[\]]/.test(raw),
      hasAtSign: raw.includes("@"),
      hasColon: raw.includes(":"),
      host: host || "(unknown)",
      portCandidate: portCandidate || "(none)",
      portIsNumeric: portCandidate ? /^\d+$/.test(portCandidate) : false,
    });

    if (raw.includes("@") && raw.includes(":") && raw.includes("[")) {
      console.log(
        "Hint: Remove placeholder brackets like [YOUR-PASSWORD] and use the real password (URL-encoded if it contains special characters)."
      );
    }
    console.log(
      "Hint: If your password contains @ or :, URL-encode it (encodeURIComponent(password)) and wrap DATABASE_URL in double-quotes."
    );
  }
}

if (!any) {
  fail("No database URL env var set. Provide DATABASE_MIGRATION_URL and/or DATABASE_URL.");
}
