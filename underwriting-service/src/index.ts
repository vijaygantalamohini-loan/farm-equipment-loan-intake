import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import routes from "./routes";
import { startProcessor } from "./queue/underwriting.processor";

dotenv.config();

const app = express();
const port = Number(process.env.UNDERWRITING_SERVICE_PORT || 7002);

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(routes);

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok", service: "underwriting-service" });
});

app.listen(port, async () => {
  await startProcessor();
  console.log(`Underwriting service listening on port ${port}`);
});
