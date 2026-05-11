import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import { scrapeMetadata } from "./api/_lib/scrape.ts";

dotenv.config({ path: ".env.local", quiet: true });
dotenv.config({ quiet: true });

function listenWithFallback(app: express.Express, startPort: number, attempts = 10): Promise<number> {
  return new Promise((resolve, reject) => {
    const tryPort = (port: number, remainingAttempts: number) => {
      const server = app.listen(port, "0.0.0.0");

      server.once("listening", () => {
        resolve(port);
      });

      server.once("error", (error: NodeJS.ErrnoException) => {
        if (error.code === "EADDRINUSE" && remainingAttempts > 0) {
          tryPort(port + 1, remainingAttempts - 1);
          return;
        }

        reject(error);
      });
    };

    tryPort(startPort, attempts);
  });
}

async function startServer() {
  const app = express();
  const configuredPort = Number(process.env.PORT);
  const PORT = Number.isFinite(configuredPort) && configuredPort > 0 ? configuredPort : 3000;

  app.use(express.json());

  app.post("/api/scrape", async (req, res) => {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    try {
      res.json(await scrapeMetadata(url));
    } catch (error) {
      console.error("Scraping error:", error);
      res.status(500).json({ error: "Failed to fetch metadata. Make sure the URL is accessible." });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const activePort = await listenWithFallback(app, PORT);
  console.log(`Server running on http://localhost:${activePort}`);
}

startServer();
