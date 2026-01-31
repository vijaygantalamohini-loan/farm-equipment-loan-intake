import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import routes from "./routes";
import { startProcessor } from "./queue/notification.processor";

dotenv.config();

const app = express();
const port = Number(process.env.NOTIFICATION_SERVICE_PORT || 7001);

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(routes);

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok", service: "notification-service" });
});

app.listen(port, async () => {
  await startProcessor();
  console.log(`Notification service listening on port ${port}`);
});
