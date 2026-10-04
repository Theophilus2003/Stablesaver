import { serve } from "@hono/node-server";
import { createApp } from "./app";

const mode = process.env.STABLESAVE_DATA_MODE === "demo" ? "demo" : "live";
const port = Number(process.env.PORT ?? 4000);

serve({ fetch: createApp({ mode }).fetch, port }, (info) => {
  console.log(`StableSave API listening on http://localhost:${info.port} (${mode === "demo" ? "DEMO DATA" : "live data from DefiLlama"})`);
});
