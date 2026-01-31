import { Router } from "express";
import { UnderwritingController } from "./controllers/underwriting.controller";

const router = Router();
const controller = new UnderwritingController();

router.post("/underwriting/requests", (req, res) => controller.create(req, res));
router.get("/underwriting/requests", (req, res) => controller.getAll(req, res));
router.get("/underwriting/requests/:id", (req, res) => controller.getById(req, res));
router.get("/underwriting/by-application/:applicationId", (req, res) => controller.getByApplicationId(req, res));
router.patch("/underwriting/requests/:id/status", (req, res) => controller.updateStatus(req, res));
router.post("/underwriting/requests/:id/notes", (req, res) => controller.addNote(req, res));
router.get("/underwriting/by-lender/:lenderId", (req, res) => controller.getByLender(req, res));
router.get("/underwriting/by-status/:status", (req, res) => controller.getByStatus(req, res));
router.get("/underwriting/requests/:id/activities", (req, res) => controller.getActivities(req, res));

export default router;
