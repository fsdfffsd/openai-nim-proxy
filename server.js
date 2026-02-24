/**
 * NVIDIA NIM OpenAI-Compatible Proxy Server
 * Use this as your custom API endpoint in JanitorAI
 * 
 * Setup:
 *   1. npm install express node-fetch
 *   2. Set your NVIDIA NIM API key below (or via env variable)
 *   3. node server.js
 *   4. In JanitorAI: set API URL to http://localhost:3000/v1
 */

const express = require("express");
const app = express();

// ─── CONFIG ──────────────────────────────────────────────────────────────────
const NVIDIA_API_KEY = process.env.NVIDIA_API_KEY || "YOUR_NVIDIA_NIM_API_KEY_HERE";
const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";

// Default model — change to any NIM-supported model
// See: https://build.nvidia.com/explore/discover
const DEFAULT_MODEL = "meta/llama-3.1-70b-instruct";

const PORT = process.env.PORT || 3000;
// ─────────────────────────────────────────────────────────────────────────────

app.use(express.json({ limit: "10mb" }));

// Allow cross-origin requests (needed for browser-based clients)
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

// Health check
app.get("/", (req, res) => {
  res.json({ status: "ok", message: "NVIDIA NIM Proxy is running" });
});

// ── Models endpoint (JanitorAI may call this) ─────────────────────────────────
app.get("/v1/models", (req, res) => {
  res.json({
    object: "list",
    data: [
      { id: "meta/llama-3.1-70b-instruct",   object: "model", owned_by: "nvidia" },
      { id: "meta/llama-3.1-8b-instruct",    object: "model", owned_by: "nvidia" },
      { id: "mistralai/mixtral-8x7b-instruct-v0.1", object: "model", owned_by: "nvidia" },
      { id: "microsoft/phi-3-medium-4k-instruct",   object: "model", owned_by: "nvidia" },
    ],
  });
});

// ── Main chat completions proxy ───────────────────────────────────────────────
app.post("/v1/chat/completions", async (req, res) => {
  try {
    const body = { ...req.body };

    // Use the requested model or fall back to default
    if (!body.model || body.model === "gpt-3.5-turbo" || body.model === "gpt-4") {
      body.model = DEFAULT_MODEL;
    }

    const isStreaming = body.stream === true;

    const nimRes = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${NVIDIA_API_KEY}`,
      },
      body: JSON.stringify(body),
    });

    if (!nimRes.ok) {
      const err = await nimRes.text();
      console.error("NIM error:", nimRes.status, err);
      return res.status(nimRes.status).json({ error: err });
    }

    // ── Streaming response ──
    if (isStreaming) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      nimRes.body.pipe(res);
      return;
    }

    // ── Non-streaming response ──
    const data = await nimRes.json();
    res.json(data);

  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n✅ NVIDIA NIM Proxy running on http://localhost:${PORT}`);
  console.log(`   JanitorAI API URL: http://localhost:${PORT}/v1`);
  console.log(`   Default model:     ${DEFAULT_MODEL}\n`);
});
