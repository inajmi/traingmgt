import { buildApp } from "./app";
import { config } from "./env";

const app = buildApp();

app.listen(config.port, () => {
  console.log(`[trainer-tracker] listening on :${config.port} (tz ${config.appTz})`);
});