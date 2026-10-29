// Fails the build on high or critical vulnerabilities in production dependencies, except for
// advisories listed below. Every exception needs a reason and an expiry date, so it cannot be
// forgotten: after the date the build fails again.
//
// Usage: npm audit --omit=dev --json > audit.json; node .github/scripts/audit-gate.mjs audit.json
import fs from "node:fs";

const ALLOWED = {
  "GHSA-mrhx-c7xc-m3w5": {
    reason:
      "zod: memory use on oversized constrained collections. Every request body is capped at 10 kB, so it cannot be triggered. Fix needs the zod 3 to 4 major upgrade.",
    expires: "2027-01-31",
  },
};

const report = JSON.parse(fs.readFileSync(process.argv[2] ?? "audit.json", "utf8"));
const now = Date.now();
const failures = [];
const waived = [];

for (const [name, vuln] of Object.entries(report.vulnerabilities ?? {})) {
  for (const via of vuln.via ?? []) {
    if (typeof via === "string") continue; // reported on the package that really has the advisory
    if (via.severity !== "high" && via.severity !== "critical") continue;
    const id = String(via.url ?? "").split("/").pop() ?? "";
    const allowed = ALLOWED[id];
    if (allowed && Date.parse(allowed.expires) > now) {
      waived.push(`${name}: ${id} (until ${allowed.expires}) ${allowed.reason}`);
    } else {
      const why = allowed ? "exception expired" : "no exception";
      failures.push(`${name}: ${via.severity} ${id} ${via.title} [${why}]`);
    }
  }
}

for (const line of waived) console.log(`waived  ${line}`);
if (failures.length > 0) {
  for (const line of failures) console.error(`FAIL    ${line}`);
  console.error("\nFix with `npm audit fix`, upgrade the package, or (rarely) add a documented exception.");
  process.exit(1);
}
console.log("No unwaived high or critical vulnerabilities in production dependencies.");
