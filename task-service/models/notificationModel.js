const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    recipientId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    recipientName: { type: String, required: true },
    recipientEmail: { type: String, required: true },
    type: {
      type: String,
      enum: ["assignment", "progress", "completion", "comment"],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: "Task", default: null },
    read: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Notification = mongoose.model("Notification", notificationSchema);

module.exports = { Notification };
