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
    throw new Error("Missing node_modules/@prisma/client; run npm install first.");
  }

  if (!hasGenerated) {
    throw new Error(
      "Missing generated Prisma client at node_modules/.prisma/client. Run `npx prisma generate`."
    );
  }

  // Prisma's package re-exports from `.prisma/client/*` relative to @prisma/client.
  // On some Windows setups, the expected `.prisma` folder/junction may not be created.
  // Copying the generated client here ensures TypeScript can resolve model delegates.
  await fs.mkdir(prismaPkgClientDir, { recursive: true });

  await fs.cp(generatedClientDir, prismaPkgClientDir, {
    recursive: true,
    force: true,
  });
}

main().catch((err) => {
  console.error(String(err?.stack || err));
  process.exit(1);
});
