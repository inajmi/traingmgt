import { buildApp } from "./app";
import { config } from "./env";
import { startScheduler } from "./lib/scheduler";

const app = buildApp();

app.listen(config.port, () => {
  console.log(`[trainer-tracker] listening on :${config.port} (tz ${config.appTz})`);
  startScheduler();
});