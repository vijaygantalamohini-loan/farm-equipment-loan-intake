import { Router } from "express";
import { NotificationController } from "./controllers/notification.controller";

const router = Router();
const controller = new NotificationController();

router.post("/notifications/send", (req, res) => controller.send(req, res));
router.get("/notifications/logs", (req, res) => controller.getLogs(req, res));
router.get("/notifications/by-recipient/:recipientId", (req, res) => controller.getRecipientNotifications(req, res));

export default router;
