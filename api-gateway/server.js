const express = require("express");
const axios = require("axios");
const cors = require("cors");
const { authenticate } = require("./authMiddleware");
const app = express();
app.use(cors());
app.use(express.json());

const USER_SERVICE = process.env.USER_SERVICE_URL || "http://user-service:3001";
const TASK_SERVICE = process.env.TASK_SERVICE_URL || "http://task-service:3002";

const forwardHeaders = (req) => ({
  Authorization: req.headers.authorization,
});

const sendServiceError = (res, err) => {
  const status = err.response?.status || 500;
  const payload = err.response?.data || { error: err.message };
  res.status(status).json(payload);
};

const fetchUserById = async (req, userId) => {
  const response = await axios.get(`${USER_SERVICE}/users/${userId}`, {
    headers: forwardHeaders(req),
  });
  return response.data;
};

const enrichTaskUsers = async (req, tasks) => {
  const userResponse = await axios.get(`${USER_SERVICE}/users`, {
    headers: forwardHeaders(req),
  });
  const usersById = new Map(
    userResponse.data.map((user) => [String(user._id || user.id), user])
  );

  return tasks.map((task) => ({
    ...task,
    userId: usersById.get(String(task.userId)) || task.userId,
  }));
};

app.get("/api/users", authenticate, async (req, res) => {
  try {
    const r = await axios.get(`${USER_SERVICE}/users`, {
      headers: forwardHeaders(req),
    });
    res.json(r.data);
  } catch (err) {
    sendServiceError(res, err);
  }
});

app.post("/api/users", async (req, res) => {
  try {
    const r = await axios.post(`${USER_SERVICE}/users`, req.body);
    res.status(r.status).json(r.data);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/users/login", async (req, res) => {
  try {
    const r = await axios.post(`${USER_SERVICE}/users/login`, req.body);
    res.status(r.status).json(r.data);
  } catch (err) {
    sendServiceError(res, err);
  }
});

app.delete("/api/users/:id", authenticate, async (req, res) => {
  try {
    const r = await axios.delete(`${USER_SERVICE}/users/${req.params.id}`, {
      headers: forwardHeaders(req),
    });
    res.status(r.status).json(r.data);
  } catch (err) {
    sendServiceError(res, err);
  }
});

app.get("/api/tasks", authenticate, async (req, res) => {
  try {
    const r = await axios.get(`${TASK_SERVICE}/tasks`, {
      headers: forwardHeaders(req),
    });
    const tasks = await enrichTaskUsers(req, r.data);
    res.json(tasks);
  } catch (err) {
    sendServiceError(res, err);
  }
});

app.post("/api/tasks", authenticate, async (req, res) => {
  try {
    const assignedUser = await fetchUserById(req, req.body.userId);
    const payload = {
      ...req.body,
      assignedUserName: assignedUser.name,
      assignedUserEmail: assignedUser.email,
    };
    const r = await axios.post(`${TASK_SERVICE}/tasks`, payload, {
      headers: forwardHeaders(req),
    });
    res.status(r.status).json(r.data);
  } catch (err) {
    sendServiceError(res, err);
  }
});

app.put("/api/tasks/:id", authenticate, async (req, res) => {
  try {
    let payload = { ...req.body };
    if (req.body.userId) {
      const assignedUser = await fetchUserById(req, req.body.userId);
      payload = {
        ...payload,
        assignedUserName: assignedUser.name,
        assignedUserEmail: assignedUser.email,
      };
    }
    const r = await axios.put(`${TASK_SERVICE}/tasks/${req.params.id}`, payload, {
      headers: forwardHeaders(req),
    });
    res.status(r.status).json(r.data);
  } catch (err) {
    sendServiceError(res, err);
  }
});

app.get("/api/tasks/me", authenticate, async (req, res) => {
  try {
    const r = await axios.get(`${TASK_SERVICE}/tasks/me`, {
      headers: forwardHeaders(req),
    });
    const tasks = await enrichTaskUsers(req, r.data);
    res.json(tasks);
  } catch (err) {
    sendServiceError(res, err);
  }
});

app.get("/api/tasks/user/:userId", authenticate, async (req, res) => {
  try {
    const r = await axios.get(`${TASK_SERVICE}/tasks/user/${req.params.userId}`, {
      headers: forwardHeaders(req),
    });
    const tasks = await enrichTaskUsers(req, r.data);
    res.json(tasks);
  } catch (err) {
    sendServiceError(res, err);
  }
});

app.patch("/api/tasks/:id/status", authenticate, async (req, res) => {
  try {
    const r = await axios.patch(`${TASK_SERVICE}/tasks/${req.params.id}/status`, req.body, {
      headers: forwardHeaders(req),
    });
    res.status(r.status).json(r.data);
  } catch (err) {
    sendServiceError(res, err);
  }
});

app.post("/api/tasks/:id/comments", authenticate, async (req, res) => {
  try {
    const r = await axios.post(`${TASK_SERVICE}/tasks/${req.params.id}/comments`, req.body, {
      headers: forwardHeaders(req),
    });
    res.status(r.status).json(r.data);
  } catch (err) {
    sendServiceError(res, err);
  }
});

app.delete("/api/tasks/:id", authenticate, async (req, res) => {
  try {
    const r = await axios.delete(`${TASK_SERVICE}/tasks/${req.params.id}`, {
      headers: forwardHeaders(req),
    });
    res.status(r.status).json(r.data);
  } catch (err) {
    sendServiceError(res, err);
  }
});

app.get("/api/notifications/me", authenticate, async (req, res) => {
  try {
    const r = await axios.get(`${TASK_SERVICE}/tasks/notifications/me`, {
      headers: forwardHeaders(req),
    });
    res.status(r.status).json(r.data);
  } catch (err) {
    sendServiceError(res, err);
  }
});

app.patch("/api/notifications/:id/read", authenticate, async (req, res) => {
  try {
    const r = await axios.patch(`${TASK_SERVICE}/tasks/notifications/${req.params.id}/read`, {}, {
      headers: forwardHeaders(req),
    });
    res.status(r.status).json(r.data);
  } catch (err) {
    sendServiceError(res, err);
  }
});

app.patch("/api/notifications/read-all", authenticate, async (req, res) => {
  try {
    const r = await axios.patch(`${TASK_SERVICE}/tasks/notifications/read-all`, {}, {
      headers: forwardHeaders(req),
    });
    res.status(r.status).json(r.data);
  } catch (err) {
    sendServiceError(res, err);
  }
});

app.listen(8080, () => console.log("API Gateway listening on 8080"));
