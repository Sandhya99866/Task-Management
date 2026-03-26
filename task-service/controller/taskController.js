const { Task } = require("../models/taskModel");
const { Notification } = require("../models/notificationModel");
const { sendMail } = require("../utils/mailer");

const isAdmin = (req) => req.user?.role === "admin";

const canAccessTask = (req, task) =>
  isAdmin(req) || String(task.userId) === String(req.user?.id);

const createNotification = async ({
  recipientId,
  recipientName,
  recipientEmail,
  type,
  title,
  message,
  taskId,
}) => {
  if (!recipientId || !recipientName || !recipientEmail) {
    return null;
  }

  return Notification.create({
    recipientId,
    recipientName,
    recipientEmail,
    type,
    title,
    message,
    taskId: taskId || null,
  });
};

const sendAssignmentEmail = async ({ recipientEmail, recipientName, taskTitle, assignedByName }) =>
  sendMail({
    to: recipientEmail,
    subject: `Task assigned: ${taskTitle}`,
    text: `Hello ${recipientName},\n\nYou have been assigned a new task: "${taskTitle}".\nAssigned by: ${assignedByName || "Admin"}.\n\nOpen TaskApp to view the task and update its progress.`,
  });

const sendCompletionEmail = async ({ recipientEmail, recipientName, taskTitle, completedByName }) =>
  sendMail({
    to: recipientEmail,
    subject: `Task completed: ${taskTitle}`,
    text: `Hello ${recipientName},\n\nThe task "${taskTitle}" has been marked as completed by ${completedByName || "a user"}.\n\nOpen TaskApp to review the update.`,
  });

const ensureTaskMetadata = (task, req) => {
  if (!task.createdBy) {
    task.createdBy = req.user?.id || task.userId || null;
  }
  if (!task.createdByName) {
    task.createdByName = req.user?.name || "Admin";
  }
  if (!task.createdByEmail) {
    task.createdByEmail = req.user?.email || "";
  }
  if (!task.assignedUserName && req.user?.name && String(task.userId) === String(req.user?.id)) {
    task.assignedUserName = req.user.name;
  }
  if (!task.assignedUserEmail && req.user?.email && String(task.userId) === String(req.user?.id)) {
    task.assignedUserEmail = req.user.email;
  }
};

const getTasks = async (req, res) => {
  try {
    const filter = isAdmin(req) ? {} : { userId: req.user.id };
    const tasks = await Task.find(filter).sort({ updatedAt: -1, createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getTasksForUser = async (req, res) => {
  try {
    if (!isAdmin(req) && String(req.user.id) !== req.params.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const tasks = await Task.find({ userId: req.params.userId }).sort({ updatedAt: -1, createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getMyTasks = async (req, res) => {
  try {
    const tasks = await Task.find({ userId: req.user.id }).sort({ updatedAt: -1, createdAt: -1 });
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const createTask = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: "Only admin can create tasks" });
    }
    const { title, userId, assignedUserName, assignedUserEmail } = req.body;
    if (!title || !userId) return res.status(400).json({ error: "title and userId required" });
    const task = new Task({
      title,
      userId,
      assignedUserName,
      assignedUserEmail,
      createdBy: req.user?.id || null,
      createdByName: req.user?.name || "Admin",
      createdByEmail: req.user?.email || "",
      status: "pending",
      completed: false,
      comments: [],
    });
    await task.save();
    await createNotification({
      recipientId: task.userId,
      recipientName: task.assignedUserName || "User",
      recipientEmail: task.assignedUserEmail || "",
      type: "assignment",
      title: "New task assigned",
      message: `You have been assigned the task "${task.title}".`,
      taskId: task._id,
    });
    const emailDelivery = await sendAssignmentEmail({
      recipientEmail: task.assignedUserEmail,
      recipientName: task.assignedUserName || "User",
      taskTitle: task.title,
      assignedByName: req.user?.name || "Admin",
    });
    res.status(201).json({
      task,
      notificationCreated: true,
      emailDelivery,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateTask = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: "Only admin can update task assignment details" });
    }
    const { id } = req.params;
    const { title, completed, userId, assignedUserName, assignedUserEmail, status } = req.body;
    const updateFields = {};
    if (title !== undefined) updateFields.title = title;
    if (completed !== undefined) updateFields.completed = completed;
    if (status !== undefined) updateFields.status = status;
    if (userId !== undefined) updateFields.userId = userId;
    if (assignedUserName !== undefined) updateFields.assignedUserName = assignedUserName;
    if (assignedUserEmail !== undefined) updateFields.assignedUserEmail = assignedUserEmail;
    if (status !== undefined) {
      updateFields.completed = status === "completed";
    } else if (completed !== undefined) {
      updateFields.status = completed ? "completed" : "pending";
    }
    const currentTask = await Task.findById(id);
    const task = await Task.findByIdAndUpdate(id, updateFields, { new: true });
    if (!task) return res.status(404).json({ error: "Task not found" });
    if (updateFields.userId && String(updateFields.userId) !== String(currentTask?.userId)) {
      await createNotification({
        recipientId: task.userId,
        recipientName: task.assignedUserName || "User",
        recipientEmail: task.assignedUserEmail || "",
        type: "assignment",
        title: "Task reassigned",
      message: `You have been assigned the task "${task.title}".`,
      taskId: task._id,
    });
      const emailDelivery = await sendAssignmentEmail({
        recipientEmail: task.assignedUserEmail,
        recipientName: task.assignedUserName || "User",
        taskTitle: task.title,
        assignedByName: req.user?.name || "Admin",
      });
      return res.json({
        task,
        reassigned: true,
        notificationCreated: true,
        emailDelivery,
      });
    }
    res.json({ task, reassigned: false, notificationCreated: false });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const updateTaskStatus = async (req, res) => {
  try {
    const { status } = req.body;
    if (!["pending", "in-progress", "completed"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });
    if (!canAccessTask(req, task)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    const previousStatus = task.status;
    ensureTaskMetadata(task, req);
    task.status = status;
    task.completed = status === "completed";
    await task.save();
    if (status === "completed" && previousStatus !== "completed") {
      await createNotification({
        recipientId: task.createdBy,
        recipientName: task.createdByName || "Admin",
        recipientEmail: task.createdByEmail || "",
        type: "completion",
        title: "Task completed",
        message: `The task "${task.title}" has been marked completed by ${req.user.name || "a user"}.`,
        taskId: task._id,
      });
      await sendCompletionEmail({
        recipientEmail: task.createdByEmail,
        recipientName: task.createdByName || "Admin",
        taskTitle: task.title,
        completedByName: req.user.name || "a user",
      });
    }

    res.json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const addTaskComment = async (req, res) => {
  try {
    const { message } = req.body;
    if (!message?.trim()) {
      return res.status(400).json({ error: "Comment message required" });
    }
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: "Task not found" });
    if (!canAccessTask(req, task)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    ensureTaskMetadata(task, req);
    task.comments.push({
      userId: req.user.id,
      userName: req.user.name || "User",
      message: message.trim(),
    });
    await task.save();
    res.status(201).json(task);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const deleteTask = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ error: "Only admin can delete tasks" });
    }
    const { id } = req.params;
    await Task.findByIdAndDelete(id);
    res.json({ message: "Task deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipientId: req.user.id })
      .sort({ createdAt: -1 });
    res.json(notifications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const markNotificationRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipientId: req.user.id },
      { read: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.json(notification);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const markAllNotificationsRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { recipientId: req.user.id, read: false },
      { read: true }
    );
    res.json({ message: "Notifications marked as read" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
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
};
