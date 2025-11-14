#!/usr/bin/env node
/**
 * Diagnostic script to debug @manypkg/get-packages package discovery
 * Used to troubleshoot changesets automation issues
 */

import { getPackages } from "@manypkg/get-packages";

try {
  const { packages, rootPackage } = await getPackages(process.cwd());

  console.log("=== ROOT PACKAGE ===");
  console.log(
    JSON.stringify(
      {
        dir: rootPackage?.dir,
        hasPackageJson: !!rootPackage?.packageJson,
        name: rootPackage?.packageJson?.name,
        version: rootPackage?.packageJson?.version,
        private: rootPackage?.packageJson?.private,
      },
      null,
      2,
    ),
  );

  console.log("\n=== WORKSPACE PACKAGES ===");
  console.log(`Found ${packages.length} packages\n`);

  packages.forEach((pkg, i) => {
    console.log(`[${i}] ${pkg?.dir || "NO DIR"}`);
    console.log(
      JSON.stringify(
        {
          hasPackageJson: !!pkg?.packageJson,
          name: pkg?.packageJson?.name || "NO NAME",
          version: pkg?.packageJson?.version || "NO VERSION",
          private: pkg?.packageJson?.private || false,
        },
        null,
        2,
      ),
    );
    console.log("");
  });

  console.log("=== SUMMARY ===");
  console.log(`Total packages: ${packages.length}`);
  console.log(
    `Packages without packageJson: ${packages.filter((p) => !p?.packageJson).length}`,
  );
  console.log(
    `Packages without name: ${packages.filter((p) => !p?.packageJson?.name).length}`,
  );
  console.log(
    `Packages without version: ${packages.filter((p) => !p?.packageJson?.version).length}`,
  );

  if (packages.some((p) => !p?.packageJson)) {
    console.log(
      "\n⚠️  WARNING: Some packages are missing packageJson property!",
    );
    console.log("This will cause changesets to fail.");
  }
} catch (error) {
  console.error("❌ ERROR:", error.message);
  console.error(error.stack);
  process.exit(1);
}
