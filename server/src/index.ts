import { buildApp } from "./app";
import { config } from "./env";
import { ensureDefaultAccessRoles } from "./lib/permissions";
import { ensureSystemSettings } from "./lib/settings";

async function main(): Promise<void> {
  await ensureSystemSettings();
  await ensureDefaultAccessRoles();

  const app = buildApp();
  app.listen(config.port, () => {
    console.log(`[trainer-tracker] listening on :${config.port} (tz ${config.appTz})`);
  });
}

main().catch((err) => {
  console.error("[trainer-tracker] failed to start:", err instanceof Error ? err.message : err);
  process.exit(1);
});