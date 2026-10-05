/**
 * Vercel entry: a Node.js (req, res) handler around the Hono app.
 * Bundled by scripts/build-vercel.mjs so the shared workspace packages are
 * inlined and nothing is resolved at runtime.
 */
import { getRequestListener } from "@hono/node-server";
import { createApp } from "./app";

const mode = process.env.STABLESAVE_DATA_MODE === "demo" ? "demo" : "live";

export default getRequestListener(createApp({ mode }).fetch);
