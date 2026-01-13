import fs from "node:fs/promises";
import path from "node:path";

async function pathExists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const workspaceRoot = process.cwd();

  const generatedClientDir = path.join(workspaceRoot, "node_modules", ".prisma", "client");
  const prismaPkgDir = path.join(workspaceRoot, "node_modules", "@prisma", "client");
  const prismaPkgClientDir = path.join(prismaPkgDir, ".prisma", "client");

  const hasGenerated = await pathExists(generatedClientDir);
  const hasPrismaPkg = await pathExists(prismaPkgDir);

  if (!hasPrismaPkg) {
    console.warn("Warning: @prisma/client not found in node_modules. Skipping Prisma client copy.");
    return;
  }

  if (!hasGenerated) {
    console.warn("Warning: Generated Prisma client not found. Skipping copy step.");
    return;
  }

  // Prisma's package re-exports from `.prisma/client/*` relative to @prisma/client.
  // On some Windows setups, the expected `.prisma` folder/junction may not be created.
  // Copying the generated client here ensures TypeScript can resolve model delegates.
  await fs.mkdir(prismaPkgClientDir, { recursive: true });

  await fs.cp(generatedClientDir, prismaPkgClientDir, {
    recursive: true,
    force: true,
  });

  console.log("✓ Prisma client copied successfully");
}

main().catch((err) => {
  console.error("Error in ensure-prisma-client:");
  console.error(String(err?.stack || err));
  console.error("Continuing build anyway...");
  // Don't exit with error code to avoid blocking build
});
