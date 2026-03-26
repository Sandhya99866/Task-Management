const express = require("express");
const {
  getTasks,
  getTasksForUser,
  getMyTasks,
  createTask,
  updateTask,
  updateTaskStatus,
  addTaskComment,
  deleteTask,
  getMyNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} = require("../controller/taskController");
const { authenticate } = require("../middleware/authMiddleware");
const router = express.Router();

router.get("/", authenticate, getTasks);
router.get("/me", authenticate, getMyTasks);
router.get("/user/:userId", authenticate, getTasksForUser);
router.post("/", authenticate, createTask);
router.put("/:id", authenticate, updateTask);
router.patch("/:id/status", authenticate, updateTaskStatus);
router.post("/:id/comments", authenticate, addTaskComment);
router.delete("/:id", authenticate, deleteTask);
router.get("/notifications/me", authenticate, getMyNotifications);
router.patch("/notifications/:id/read", authenticate, markNotificationRead);
router.patch("/notifications/read-all", authenticate, markAllNotificationsRead);

module.exports = router;
