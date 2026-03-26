const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  title: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  assignedUserName: { type: String },
  assignedUserEmail: { type: String },
  createdBy: { type: mongoose.Schema.Types.ObjectId, default: null },
  createdByName: { type: String, default: "Admin" },
  createdByEmail: { type: String, default: "" },
  status: {
    type: String,
    enum: ["pending", "in-progress", "completed"],
    default: "pending",
  },
  completed: { type: Boolean, default: false },
  comments: [
    {
      userId: { type: mongoose.Schema.Types.ObjectId, required: true },
      userName: { type: String, required: true },
      message: { type: String, required: true },
      createdAt: { type: Date, default: Date.now },
    },
  ],
}, { timestamps: true });

const Task = mongoose.model('Task', taskSchema);

const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/taskapp');
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err);
  }
};

module.exports = { Task, connectDB };
