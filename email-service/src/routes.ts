import { Router } from "express";
import { EmailController } from "./controllers/email.controller";

const router = Router();
const controller = new EmailController();

router.post("/email/send", (req, res) => controller.send(req, res));
router.get("/email/logs", (req, res) => controller.getLogs(req, res));

export default router;
