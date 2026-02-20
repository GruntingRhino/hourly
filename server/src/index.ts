import express from "express";
import cors from "cors";
import path from "path";
import authRoutes from "./routes/auth";
import opportunityRoutes from "./routes/opportunities";
import signupRoutes from "./routes/signups";
import sessionRoutes from "./routes/sessions";
import verificationRoutes from "./routes/verification";
import organizationRoutes from "./routes/organizations";
import schoolRoutes from "./routes/schools";
import classroomRoutes from "./routes/classrooms";
import messageRoutes from "./routes/messages";
import reportRoutes from "./routes/reports";
import savedRoutes from "./routes/saved";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/opportunities", opportunityRoutes);
app.use("/api/signups", signupRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/verification", verificationRoutes);
app.use("/api/organizations", organizationRoutes);
app.use("/api/schools", schoolRoutes);
app.use("/api/classrooms", classroomRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/saved", savedRoutes);

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`GoodHours API running on http://localhost:${PORT}`);
});

export default app;
