const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const { connectDB } = require("./models/taskModel");
const taskRoutes = require("./routes/taskRoutes");
const app = express();
app.use(cors());
app.use(express.json());
app.use("/tasks", taskRoutes);

const backfillLegacyTasks = async () => {
  try {
    const admin = await mongoose.connection.collection("users").findOne({ role: "admin" });
    if (!admin) {
      return;
    }

    await mongoose.connection.collection("tasks").updateMany(
      {
        $or: [
          { createdBy: { $exists: false } },
          { createdBy: null },
          { createdByName: { $exists: false } },
          { createdByName: "" },
          { createdByEmail: { $exists: false } },
          { createdByEmail: "" },
        ],
      },
      {
        $set: {
          createdBy: admin._id,
          createdByName: admin.name,
          createdByEmail: admin.email,
        },
      }
    );
  } catch (error) {
    console.error("Task backfill error:", error);
  }
};

connectDB().then(backfillLegacyTasks);

app.listen(process.env.PORT || 3002, () => {
  console.log("Task service listening on port", process.env.PORT || 3002);
});
