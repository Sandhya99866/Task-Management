import { useEffect, useState } from "react";
import axios from "axios";
import { jwtDecode } from "jwt-decode";
import "./App.css";

const API = import.meta.env.VITE_API_GATEWAY || "http://localhost:8080/api";

const emptyAuthForm = { name: "", email: "", password: "", role: "user" };
const emptyUserForm = { name: "", email: "", password: "" };
const emptyTaskForm = { title: "", userId: "" };
const emptyAssignForm = { taskId: "", userId: "" };

const statusOptions = ["pending", "in-progress", "completed"];

const toStatusLabel = (status) =>
  ({
    pending: "Pending",
    "in-progress": "In Progress",
    completed: "Completed",
  }[status] || "Pending");

const toStatusClass = (status) =>
  ({
    pending: "status-pending",
    "in-progress": "status-info",
    completed: "status-done",
  }[status] || "status-pending");

const getTaskStatus = (task) => task.status || (task.completed ? "completed" : "pending");

const taskIdOf = (task) => task._id || task.id;
const userIdOf = (user) => user?._id || user?.id;

const safeStorageGet = (key, fallback = null) => {
  try {
    const value = localStorage.getItem(key);
    return value ?? fallback;
  } catch {
    return fallback;
  }
};

const safeStorageSet = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures so the app can still render in restricted browsers.
  }
};

const safeStorageRemove = (key) => {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore storage failures so logout still works in restricted browsers.
  }
};

export default function App() {
  const [token, setToken] = useState(() => safeStorageGet("token", ""));
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [isLogin, setIsLogin] = useState(true);
  const [page, setPage] = useState("home");
  const [authForm, setAuthForm] = useState(emptyAuthForm);
  const [userForm, setUserForm] = useState(emptyUserForm);
  const [taskForm, setTaskForm] = useState(emptyTaskForm);
  const [assignForm, setAssignForm] = useState(emptyAssignForm);
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [assignmentSearch, setAssignmentSearch] = useState("");
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState([]);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [seenNotificationIds, setSeenNotificationIds] = useState([]);

  const isAuthenticated = Boolean(user && token);
  const isAdmin = user?.role === "admin";
  const notificationStorageKey = `taskapp_seen_notifications_${user?.id || "guest"}`;

  useEffect(() => {
    if (!token) {
      setUser(null);
      setUsers([]);
      setTasks([]);
      delete axios.defaults.headers.common.Authorization;
      return;
    }

    try {
      const decoded = jwtDecode(token);
      setUser(decoded);
      axios.defaults.headers.common.Authorization = `Bearer ${token}`;
    } catch (error) {
      localStorage.removeItem("token");
      setToken(null);
      setUser(null);
      delete axios.defaults.headers.common.Authorization;
      return;
    }

    loadData();
  }, [token]);

  useEffect(() => {
    try {
      const stored = JSON.parse(safeStorageGet(notificationStorageKey, "[]") || "[]");
      setSeenNotificationIds(Array.isArray(stored) ? stored : []);
    } catch {
      setSeenNotificationIds([]);
    }
  }, [notificationStorageKey]);

  useEffect(() => {
    safeStorageSet(notificationStorageKey, JSON.stringify(seenNotificationIds));
  }, [notificationStorageKey, seenNotificationIds]);

  const loadData = async () => {
    try {
      const taskEndpoint = isAdmin ? `${API}/tasks` : `${API}/tasks/me`;
      const requests = [axios.get(taskEndpoint), axios.get(`${API}/notifications/me`)];

      if (isAdmin) {
        requests.unshift(axios.get(`${API}/users`));
      }

      const responses = await Promise.all(requests);
      if (isAdmin) {
        setUsers(responses[0].data);
        setTasks(responses[1].data);
        setNotifications(responses[2].data);
      } else {
        setUsers([]);
        setTasks(responses[0].data);
        setNotifications(responses[1].data);
      }
    } catch (error) {
      if (error.response?.status === 401) {
        setUsers([]);
        setTasks([]);
        setNotifications([]);
        return;
      }
      console.error(error);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, isAdmin]);

  const handleAuth = async (event) => {
    event.preventDefault();

    try {
      const endpoint = isLogin ? "/users/login" : "/users";
      const payload = isLogin
        ? { email: authForm.email, password: authForm.password }
        : authForm;
      const response = await axios.post(`${API}${endpoint}`, payload);

      if (isLogin) {
        setToken(response.data.token);
        safeStorageSet("token", response.data.token);
        axios.defaults.headers.common.Authorization = `Bearer ${response.data.token}`;
        setUser(response.data.user);
        setPage(response.data.user?.role === "admin" ? "assign" : "tasks");
      } else {
        alert("Account created. Please log in.");
        setIsLogin(true);
      }

      setAuthForm(emptyAuthForm);
    } catch (error) {
      alert(error.response?.data?.error || "Authentication failed");
    }
  };

  const logout = () => {
    safeStorageRemove("token");
    setToken(null);
    setUser(null);
    setPage("home");
  };

  const goToPage = (nextPage) => {
    const protectedPages = ["tasks", "assign", "progress", "notifications"];
    const adminOnlyPages = ["assign", "progress"];

    if (!isAuthenticated && protectedPages.includes(nextPage)) {
      setPage("login");
      return;
    }

    if (!isAdmin && adminOnlyPages.includes(nextPage)) {
      setPage("tasks");
      return;
    }

    setPage(nextPage);
  };

  const addUser = async (event) => {
    event.preventDefault();

    try {
      const normalizedEmail = userForm.email.trim().toLowerCase();
      const emailExists = users.some(
        (listedUser) => listedUser.email?.trim().toLowerCase() === normalizedEmail
      );

      if (emailExists) {
        alert("Email already exists");
        return;
      }

      const payload = {
        name: userForm.name.trim(),
        email: normalizedEmail,
        password: userForm.password,
      };
      const response = await axios.post(`${API}/users`, payload);
      setUsers((current) => [response.data, ...current.filter((listedUser) => listedUser.email !== response.data.email)]);
      setUserForm(emptyUserForm);
      setPage("assign");
    } catch (error) {
      alert(error.response?.data?.error || error.message || "Could not add user");
    }
  };

  const deleteUser = async (id) => {
    if (!window.confirm("Delete user?")) {
      return;
    }

    try {
      await axios.delete(`${API}/users/${id}`);
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || "Could not delete user");
    }
  };

  const addTask = async (event) => {
    event.preventDefault();
    if (!taskForm.title || !taskForm.userId) {
      return;
    }

    try {
      await axios.post(`${API}/tasks`, taskForm);
      setTaskForm(emptyTaskForm);
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || "Could not add task");
    }
  };

  const toggleAssignee = (userId) => {
    setSelectedAssigneeIds((current) =>
      current.includes(userId)
        ? current.filter((id) => id !== userId)
        : [...current, userId]
    );
  };

  const assignTasksToMultipleUsers = async (event) => {
    event.preventDefault();

    if (!assignmentTitle.trim() || !selectedAssigneeIds.length) {
      alert("Add a task title and select at least one person.");
      return;
    }
    if (!isAdmin) {
      alert("Only admin can assign tasks.");
      return;
    }

    try {
      const responses = await Promise.all(
        selectedAssigneeIds.map((userId) =>
          axios.post(`${API}/tasks`, {
            title: assignmentTitle.trim(),
            userId,
          })
        )
      );

      const sentCount = responses.filter((response) => response.data?.emailDelivery?.sent).length;
      const unsentCount = responses.length - sentCount;

      setAssignmentTitle("");
      setAssignmentSearch("");
      setSelectedAssigneeIds([]);
      await loadData();
      setPage("assign");
      alert(
        unsentCount
          ? `Task assigned to ${responses.length} people. Email sent to ${sentCount}. ${unsentCount} could not be emailed because SMTP is not configured.`
          : `Task assigned to ${responses.length} people and email sent successfully.`
      );
    } catch (error) {
      alert(error.response?.data?.error || "Could not assign tasks");
    }
  };

  const updateTaskStatus = async (taskId, status) => {
    try {
      await axios.patch(`${API}/tasks/${taskId}/status`, { status });
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || "Could not update task status");
    }
  };

  const addComment = async (taskId) => {
    const message = commentDrafts[taskId]?.trim();
    if (!message) {
      return;
    }

    try {
      await axios.post(`${API}/tasks/${taskId}/comments`, { message });
      setCommentDrafts((current) => ({ ...current, [taskId]: "" }));
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || "Could not add comment");
    }
  };

  const describeEmailDelivery = (delivery) => {
    if (!delivery) {
      return "Task assigned. Email status unavailable.";
    }

    if (delivery.sent) {
      return "Task assigned and email sent to the assignee.";
    }

    if (delivery.reason === "SMTP not configured") {
      return "Task assigned. Email was not sent because SMTP is not configured.";
    }

    return "Task assigned, but email delivery did not complete.";
  };

  const assignTask = async (event) => {
    event.preventDefault();
    if (!assignForm.taskId || !assignForm.userId) {
      return;
    }
    if (!isAdmin) {
      alert("Only admin can assign tasks.");
      return;
    }

    try {
      const response = await axios.put(`${API}/tasks/${assignForm.taskId}`, {
        userId: assignForm.userId,
      });
      setAssignForm(emptyAssignForm);
      await loadData();
      setPage("progress");
      alert(describeEmailDelivery(response.data?.emailDelivery));
    } catch (error) {
      alert(error.response?.data?.error || "Assignment failed");
    }
  };

  const visibleTeamUsers = users.filter((listedUser) => listedUser.role !== "admin");

  const deleteTask = async (taskId) => {
    if (!window.confirm("Delete task?")) {
      return;
    }

    try {
      await axios.delete(`${API}/tasks/${taskId}`);
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || "Could not delete task");
    }
  };

  const visibleTasks = tasks.map((task) => ({
    ...task,
    status: getTaskStatus(task),
  }));
  const assignedTasks = visibleTasks.filter((task) => task.userId);
  const completedTasks = visibleTasks.filter((task) => task.status === "completed").length;
  const inProgressTasks = visibleTasks.filter((task) => task.status === "in-progress").length;
  const pendingTasks = visibleTasks.filter((task) => task.status === "pending").length;
  const completionRate = visibleTasks.length
    ? Math.round((completedTasks / visibleTasks.length) * 100)
    : 0;
  const unreadNotifications = notifications.filter((item) => !item.read).length;

  const stats = [
    { label: isAdmin ? "Users" : "My Tasks", value: isAdmin ? users.length : visibleTasks.length },
    { label: "In Progress", value: inProgressTasks },
    { label: "Completed", value: completedTasks },
    { label: "Notifications", value: unreadNotifications },
  ];

  const progressByUser = users
    .map((listedUser) => {
      const userTasks = visibleTasks.filter((task) => {
        const assignedUser = task.userId;
        const assignedId =
          typeof assignedUser === "object" ? userIdOf(assignedUser) : assignedUser;
        return String(assignedId) === String(userIdOf(listedUser));
      });
      const doneCount = userTasks.filter((task) => task.status === "completed").length;
      const rate = userTasks.length ? Math.round((doneCount / userTasks.length) * 100) : 0;

      return {
        id: userIdOf(listedUser),
        name: listedUser.name,
        email: listedUser.email,
        total: userTasks.length,
        completed: doneCount,
        pending: userTasks.length - doneCount,
        rate,
      };
    })
    .filter((entry) => entry.total > 0)
    .sort((left, right) => right.total - left.total);

  const teamMembers = users.filter((listedUser) => listedUser.role !== "admin");
  const filteredTeamMembers = teamMembers.filter((listedUser) => {
    const query = assignmentSearch.trim().toLowerCase();
    if (!query) return true;
    return (
      listedUser.name?.toLowerCase().includes(query) ||
      listedUser.email?.toLowerCase().includes(query)
    );
  });

  const assignmentsByUser = teamMembers
    .map((listedUser) => {
      const userTasks = visibleTasks.filter((task) => {
        const assignedUser = task.userId;
        const assignedId =
          typeof assignedUser === "object" ? userIdOf(assignedUser) : assignedUser;
        return String(assignedId) === String(userIdOf(listedUser));
      });

      return {
        id: userIdOf(listedUser),
        name: listedUser.name,
        email: listedUser.email,
        role: listedUser.role,
        tasks: userTasks,
      };
    })
    .filter((entry) => entry.tasks.length > 0 || entry.id)
    .sort((left, right) => right.tasks.length - left.tasks.length);

  const userName = user?.name || "Guest";

  const markNotificationRead = async (id) => {
    try {
      await axios.patch(`${API}/notifications/${id}/read`);
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || "Could not mark notification as read");
    }
  };

  const markAllNotificationsRead = async () => {
    try {
      await axios.patch(`${API}/notifications/read-all`);
      loadData();
    } catch (error) {
      alert(error.response?.data?.error || "Could not update notifications");
    }
  };

  return (
    <div className="app-shell">
      <div className="app-bg app-bg-one" />
      <div className="app-bg app-bg-two" />

      <div className="app-container">
        <header className="topbar">
          <div>
            <p className="eyebrow">Task management workspace</p>
            <h1>TaskApp</h1>
          </div>
          <div className="topbar-user">
            <span>
              Welcome, {userName}
              {isAuthenticated && ` (${isAdmin ? "Admin" : "User"})`}
            </span>
            {user && (
              <button type="button" className="button button-danger" onClick={logout}>
                Logout
              </button>
            )}
          </div>
        </header>

        <nav className="nav-tabs" aria-label="Page navigation">
          {[
            ["home", "Home"],
            ["login", isLogin ? "Login" : "Signup"],
            ["tasks", "My Tasks"],
            ["notifications", `Notifications${unreadNotifications ? ` (${unreadNotifications})` : ""}`],
            ["progress", "Progress"],
          ]
            .filter(([key]) => isAuthenticated || ["home", "login"].includes(key))
            .filter(([key]) => isAdmin || (key !== "assign" && key !== "progress"))
            .map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  className={page === key ? "active" : ""}
                  onClick={() => goToPage(key)}
                >
                  {label}
                </button>
            ))}
        </nav>

        {page === "home" && (
          <section className="home-layout">
            <div className="hero-card">
              <div className="hero-copy">
                <p className="section-kicker">Home Page</p>
                <h2>Plan work, send notifications, and track delivery clearly.</h2>
                <p>
                  This version supports role-based access, task assignment notifications,
                  task status tracking, and per-task comments for collaboration.
                </p>
                {!isAuthenticated && (
                  <p className="auth-notice">
                    Sign in first to access tasks, assignment workflows, and progress tracking.
                  </p>
                )}
                <div className="hero-actions">
                  <button type="button" className="button button-primary" onClick={() => goToPage("login")}>
                    Open Login
                  </button>
                  <button
                    type="button"
                    className="button button-secondary"
                    onClick={() => goToPage(isAdmin ? "assign" : "tasks")}
                  >
                    Open Workspace
                  </button>
                </div>
              </div>

              <div className="hero-panel">
                {stats.map((item) => (
                  <div key={item.label} className="stat-card">
                    <span>{item.label}</span>
                    <strong>{item.value}</strong>
                  </div>
                ))}
                <div className="status-card">
                  <p>Current completion</p>
                  <strong>{completionRate}% done</strong>
                  <span>{pendingTasks} tasks are still pending.</span>
                </div>
              </div>
            </div>

            <div className="feature-grid">
              <article className="feature-card">
                <p className="section-kicker">01</p>
                <h3>Secure access</h3>
                <p>Only signed-in users can access tasks, with admin-only control pages.</p>
              </article>
              <article className="feature-card">
                <p className="section-kicker">02</p>
                <h3>Progress tracking</h3>
                <p>Assignments and task updates are tracked in one place with clear status indicators.</p>
              </article>
              <article className="feature-card">
                <p className="section-kicker">03</p>
                <h3>Status and comments</h3>
                <p>Tasks move through pending, in-progress, and completed states with user responses.</p>
              </article>
            </div>
          </section>
        )}

        {page === "login" && (
          <section className="page-card auth-card">
            <div className="card-heading">
              <div>
                <p className="section-kicker">Authentication</p>
                <h2>{isLogin ? "Login" : "Create account"}</h2>
              </div>
              <p>
                {isAuthenticated
                  ? `You are signed in as ${isAdmin ? "admin" : "user"}.`
                  : isLogin
                  ? "Use your email and password to enter the workspace."
                  : "Create your account and choose a role."}
              </p>
            </div>

            {isAuthenticated ? (
              <div className="locked-card">
                <p>Your account is active. Open the available sections from the navigation bar.</p>
                <button type="button" className="button button-primary" onClick={() => goToPage("tasks")}>
                  Go To Workspace
                </button>
              </div>
            ) : (
              <>
                <form className="auth-form" onSubmit={handleAuth}>
                  {!isLogin && (
                    <input
                      type="text"
                      placeholder="Full name"
                      value={authForm.name}
                      onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })}
                      required
                    />
                  )}
                  <input
                    type="email"
                    placeholder="Email address"
                    value={authForm.email}
                    onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
                    required
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={authForm.password}
                    onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
                    required
                  />
                  {!isLogin && (
                    <select
                      value={authForm.role}
                      onChange={(event) => setAuthForm({ ...authForm, role: event.target.value })}
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  )}
                  {!isLogin && <p className="form-note">Choose User or Admin before creating the account.</p>}
                  <button type="submit" className="button button-primary button-block">
                    {isLogin ? "Login" : "Signup"}
                  </button>
                </form>

                <button
                  type="button"
                  className="text-link"
                  onClick={() => setIsLogin((current) => !current)}
                >
                  {isLogin ? "Need an account? Signup" : "Already have an account? Login"}
                </button>
              </>
            )}
          </section>
        )}

        {!isAuthenticated && ["tasks", "assign", "progress"].includes(page) && (
          <section className="page-card auth-card">
            <div className="card-heading">
              <div>
                <p className="section-kicker">Protected Access</p>
                <h2>Login required</h2>
              </div>
              <p>Only signed-in users can view tasks and progress features.</p>
            </div>

            <div className="locked-card">
              <p>Create an account or log in to unlock the workspace.</p>
              <button type="button" className="button button-primary" onClick={() => goToPage("login")}>
                Go To Login
              </button>
            </div>
          </section>
        )}

        {isAuthenticated && page === "notifications" && (
          <section className="page-card full-width-card">
            <div className="card-heading">
              <div>
                <p className="section-kicker">Notifications</p>
                <h2>{isAdmin ? "Team notifications" : "Your notifications"}</h2>
              </div>
              <p>Recent assignment and completion alerts from the admin workflow.</p>
            </div>

            <div className="notifications-toolbar">
              <div className="mini-stats">
                <span>{notifications.length} total</span>
                <span>{unreadNotifications} unread</span>
              </div>
              <button type="button" className="button button-secondary" onClick={markAllNotificationsRead}>
                Mark all read
              </button>
            </div>

            <div className="list-stack">
              {notifications.map((item) => {
                const unread = !item.read;
                return (
                  <div key={item._id || item.id} className={`notification-card ${unread ? "is-unread" : ""}`}>
                    <div className="notification-head">
                      <div>
                        <strong>{item.title}</strong>
                        <span>{item.message}</span>
                      </div>
                      <span className={`status-pill ${unread ? "status-info" : "status-done"}`}>
                        {unread ? "New" : "Read"}
                      </span>
                    </div>
                    <div className="notification-meta">
                      <span>{new Date(item.createdAt || item.updatedAt).toLocaleString()}</span>
                      <span>Type: {item.type}</span>
                    </div>
                    {unread && (
                      <button
                        type="button"
                        className="button button-primary"
                        onClick={() => markNotificationRead(item._id || item.id)}
                      >
                        Mark Read
                      </button>
                    )}
                  </div>
                );
              })}
              {!notifications.length && <p className="empty-state">No notifications yet.</p>}
            </div>
          </section>
        )}

        {isAuthenticated && page === "tasks" && isAdmin && (
          <section className="dashboard-grid">
            <article className="page-card">
              <div className="card-heading compact">
                <div>
                  <p className="section-kicker">Users</p>
                  <h2>Team members</h2>
                </div>
              </div>

              <form className="stack-form" onSubmit={addUser}>
                <input
                  type="text"
                  placeholder="Name"
                  value={userForm.name}
                  onChange={(event) => setUserForm({ ...userForm, name: event.target.value })}
                  required
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={userForm.email}
                  onChange={(event) => setUserForm({ ...userForm, email: event.target.value })}
                  required
                />
                <input
                  type="password"
                  placeholder="Password"
                  value={userForm.password}
                  onChange={(event) => setUserForm({ ...userForm, password: event.target.value })}
                  required
                />
                <button type="submit" className="button button-success button-block">
                  Add User
                </button>
              </form>

              <div className="list-stack">
                {users.map((listedUser) => (
                  <div key={userIdOf(listedUser)} className="list-row">
                    <div>
                      <strong>
                        {listedUser.name} {listedUser.role === "admin" ? "(Admin)" : ""}
                      </strong>
                      <span>{listedUser.email}</span>
                    </div>
                    <button
                      type="button"
                      className="button button-danger"
                      onClick={() => deleteUser(userIdOf(listedUser))}
                    >
                      Delete
                    </button>
                  </div>
                ))}
                {!users.length && <p className="empty-state">No users added yet.</p>}
              </div>
            </article>

            <article className="page-card">
              <div className="card-heading compact">
                <div>
                  <p className="section-kicker">Tasks</p>
                  <h2>Admin task board</h2>
                </div>
              </div>

              <form className="stack-form" onSubmit={addTask}>
                <input
                  type="text"
                  placeholder="Task title"
                  value={taskForm.title}
                  onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })}
                  required
                />
                <select
                  value={taskForm.userId}
                  onChange={(event) => setTaskForm({ ...taskForm, userId: event.target.value })}
                  required
                >
                  <option value="">Select user</option>
                  {visibleTeamUsers
                    .map((listedUser) => (
                      <option key={userIdOf(listedUser)} value={userIdOf(listedUser)}>
                        {listedUser.name}
                      </option>
                    ))}
                </select>
                <button type="submit" className="button button-primary button-block">
                  Create Task
                </button>
              </form>

              <div className="list-stack">
                {visibleTasks.map((task) => (
                  <div key={taskIdOf(task)} className="task-card">
                    <div className="task-card-header">
                      <div>
                        <strong>{task.title}</strong>
                        <span>
                          {task.userId?.name || task.assignedUserName || "Unknown user"} •{" "}
                          {task.userId?.email || task.assignedUserEmail || "No email"}
                        </span>
                      </div>
                      <span className={`status-pill ${toStatusClass(task.status)}`}>
                        {toStatusLabel(task.status)}
                      </span>
                    </div>
                    <div className="task-meta-row">
                      <span>{task.comments?.length || 0} comments</span>
                      <span>Created by {task.createdByName}</span>
                    </div>
                    {task.comments?.length > 0 && (
                      <div className="comment-list">
                        {task.comments.map((comment, index) => (
                          <div key={`${taskIdOf(task)}-${index}`} className="comment-item">
                            <strong>{comment.userName}</strong>
                            <span>{comment.message}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="row-actions">
                      {statusOptions.map((status) => (
                        <button
                          key={status}
                          type="button"
                          className={`button ${status === "completed" ? "button-success" : "button-secondary"}`}
                          onClick={() => updateTaskStatus(taskIdOf(task), status)}
                        >
                          {toStatusLabel(status)}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="button button-danger"
                        onClick={() => deleteTask(taskIdOf(task))}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
                {!visibleTasks.length && <p className="empty-state">No tasks created yet.</p>}
              </div>
            </article>
          </section>
        )}

        {page === "assign" && (
          <section className="assign-workspace">
            <article className="page-card auth-card full-width-card">
              <div className="card-heading">
                <div>
                  <p className="section-kicker">Login / Signup</p>
                  <h2>{isLogin ? "Login" : "Signup"}</h2>
                </div>
                <p>
                  {isAuthenticated
                    ? "You are signed in and can assign tasks."
                    : "Sign in first to manage users and assign tasks."}
                </p>
              </div>

              {isAuthenticated ? (
                <div className="locked-card">
                  <p>Signed in as {user?.name || "Guest"}. Use the workspace below to assign tasks.</p>
                </div>
              ) : (
                <>
                  <form className="auth-form" onSubmit={handleAuth}>
                    {!isLogin && (
                      <input
                        type="text"
                        placeholder="Full name"
                        value={authForm.name}
                        onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })}
                        required
                      />
                    )}
                    <input
                      type="email"
                      placeholder="Email address"
                      value={authForm.email}
                      onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })}
                      required
                    />
                    <input
                      type="password"
                      placeholder="Password"
                      value={authForm.password}
                      onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
                      required
                    />
                    {!isLogin && (
                      <select
                        value={authForm.role}
                        onChange={(event) => setAuthForm({ ...authForm, role: event.target.value })}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    )}
                    <button type="submit" className="button button-primary button-block">
                      {isLogin ? "Login" : "Signup"}
                    </button>
                  </form>

                  <button
                    type="button"
                    className="text-link"
                    onClick={() => setIsLogin((current) => !current)}
                  >
                    {isLogin ? "Need an account? Signup" : "Already have an account? Login"}
                  </button>
                </>
              )}
            </article>

            <div className="dashboard-grid assign-dashboard">
              <article className="page-card">
                <div className="card-heading compact">
                  <div>
                    <p className="section-kicker">Users</p>
                    <h2>Team members</h2>
                  </div>
                </div>

                <form className="stack-form" onSubmit={addUser}>
                  <input
                    type="text"
                    placeholder="Name"
                    value={userForm.name}
                    onChange={(event) => setUserForm({ ...userForm, name: event.target.value })}
                    required
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={userForm.email}
                    onChange={(event) => setUserForm({ ...userForm, email: event.target.value })}
                    required
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={userForm.password}
                    onChange={(event) => setUserForm({ ...userForm, password: event.target.value })}
                    required
                  />
                  <button type="submit" className="button button-success button-block">
                    Add User
                  </button>
                </form>

                <div className="list-stack">
                  {users.map((listedUser) => (
                    <div key={userIdOf(listedUser)} className="list-row">
                      <div>
                        <strong>{listedUser.name}</strong>
                        <span>{listedUser.email}</span>
                      </div>
                      <button
                        type="button"
                        className="button button-danger"
                        onClick={() => deleteUser(userIdOf(listedUser))}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                  {!users.length && <p className="empty-state">No users added yet.</p>}
                </div>
              </article>

              <article className="page-card">
                <div className="card-heading compact">
                  <div>
                    <p className="section-kicker">Tasks</p>
                    <h2>Tasks</h2>
                  </div>
                </div>

                <form className="stack-form" onSubmit={addTask}>
                  <input
                    type="text"
                    placeholder="Task title"
                    value={taskForm.title}
                    onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })}
                    required
                  />
                  <select
                    value={taskForm.userId}
                    onChange={(event) => setTaskForm({ ...taskForm, userId: event.target.value })}
                    required
                  >
                    <option value="">Select user</option>
                    {users
                      .filter((listedUser) => listedUser.role !== "admin")
                      .map((listedUser) => (
                        <option key={userIdOf(listedUser)} value={userIdOf(listedUser)}>
                          {listedUser.name}
                        </option>
                      ))}
                  </select>
                  <button type="submit" className="button button-primary button-block">
                    Add Task
                  </button>
                </form>

                <div className="list-stack">
                  {assignedTasks.map((task) => (
                    <div key={taskIdOf(task)} className="list-row task-row">
                      <div>
                        <strong className={task.status === "completed" ? "is-complete" : ""}>
                          {task.title}
                        </strong>
                        <span>
                          {task.userId?.name || task.assignedUserName || "Unknown user"} •{" "}
                          {toStatusLabel(task.status)}
                        </span>
                      </div>
                      <div className="row-actions">
                        <button
                          type="button"
                          className={`button ${task.status === "completed" ? "button-warning" : "button-success"}`}
                          onClick={() =>
                            updateTaskStatus(
                              taskIdOf(task),
                              task.status === "completed" ? "pending" : "completed"
                            )
                          }
                        >
                          {task.status === "completed" ? "Undo" : "Complete"}
                        </button>
                        <button
                          type="button"
                          className="button button-danger"
                          onClick={() => deleteTask(taskIdOf(task))}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                  {!assignedTasks.length && <p className="empty-state">No assigned tasks yet. Assign one to save it here.</p>}
                </div>
              </article>
            </div>
          </section>
        )}

        {isAuthenticated && page === "tasks" && !isAdmin && (
          <section className="page-card full-width-card">
            <div className="card-heading compact">
              <div>
                <p className="section-kicker">My Tasks</p>
                <h2>Assigned work</h2>
              </div>
              <p>Update your status and add a response/comment on each task.</p>
            </div>

            <div className="list-stack">
              {visibleTasks.map((task) => (
                <div key={taskIdOf(task)} className="task-card">
                  <div className="task-card-header">
                    <div>
                      <strong>{task.title}</strong>
                      <span>Assigned by {task.createdByName}</span>
                    </div>
                    <span className={`status-pill ${toStatusClass(task.status)}`}>
                      {toStatusLabel(task.status)}
                    </span>
                  </div>

                  <div className="task-user-actions">
                    <select
                      value={task.status}
                      onChange={(event) => updateTaskStatus(taskIdOf(task), event.target.value)}
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {toStatusLabel(status)}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="comment-box">
                    <textarea
                      placeholder="Add your response/comment"
                      value={commentDrafts[taskIdOf(task)] || ""}
                      onChange={(event) =>
                        setCommentDrafts((current) => ({
                          ...current,
                          [taskIdOf(task)]: event.target.value,
                        }))
                      }
                    />
                    <button type="button" className="button button-primary" onClick={() => addComment(taskIdOf(task))}>
                      Add Comment
                    </button>
                  </div>

                  <div className="comment-list">
                    {(task.comments || []).map((comment, index) => (
                      <div key={`${taskIdOf(task)}-${index}`} className="comment-item">
                        <strong>{comment.userName}</strong>
                        <span>{comment.message}</span>
                      </div>
                    ))}
                    {!task.comments?.length && <p className="empty-state">No comments added yet.</p>}
                  </div>
                </div>
              ))}
              {!visibleTasks.length && (
                <p className="empty-state">No tasks are assigned to you yet.</p>
              )}
            </div>
          </section>
        )}

        {isAuthenticated && isAdmin && page === "progress" && (
          <section className="progress-layout">
            <div className="progress-overview-grid">
              <article className="page-card overview-card">
                <p className="section-kicker">Overview</p>
                <h2>Task progress</h2>
                <div className="progress-bar-track large">
                  <div className="progress-bar-fill" style={{ width: `${completionRate}%` }} />
                </div>
                <div className="overview-stats">
                  <div>
                    <span>Total tasks</span>
                    <strong>{visibleTasks.length}</strong>
                  </div>
                  <div>
                    <span>Completed</span>
                    <strong>{completedTasks}</strong>
                  </div>
                  <div>
                    <span>Pending</span>
                    <strong>{pendingTasks}</strong>
                  </div>
                </div>
              </article>

              <article className="page-card overview-card">
                <p className="section-kicker">Assignments</p>
                <h2>User progress tracking</h2>
                <div className="overview-stats compact-overview">
                  <div>
                    <span>Assigned tasks</span>
                    <strong>{assignedTasks.length}</strong>
                  </div>
                  <div>
                    <span>Users working</span>
                    <strong>{progressByUser.length}</strong>
                  </div>
                </div>
              </article>
            </div>

            <div className="dashboard-grid">
              <article className="page-card">
                <div className="card-heading compact">
                  <div>
                    <p className="section-kicker">By User</p>
                    <h2>User progress</h2>
                  </div>
                </div>

                <div className="list-stack">
                  {progressByUser.map((entry) => (
                    <div key={entry.id} className="progress-user-card">
                      <div className="progress-user-header">
                        <div>
                          <strong>{entry.name}</strong>
                          <span>{entry.email}</span>
                        </div>
                        <span className="status-pill status-info">{entry.rate}%</span>
                      </div>
                      <div className="progress-bar-track">
                        <div className="progress-bar-fill" style={{ width: `${entry.rate}%` }} />
                      </div>
                      <div className="mini-stats">
                        <span>{entry.completed} completed</span>
                        <span>{entry.pending} pending</span>
                        <span>{entry.total} total</span>
                      </div>
                    </div>
                  ))}
                  {!progressByUser.length && (
                    <p className="empty-state">No assigned users yet. Create and assign tasks first.</p>
                  )}
                </div>
              </article>

              <article className="page-card">
                <div className="card-heading compact">
                  <div>
                    <p className="section-kicker">By Task</p>
                    <h2>Task activity</h2>
                  </div>
                </div>

                <div className="list-stack">
                  {assignedTasks.map((task) => (
                    <div key={taskIdOf(task)} className="progress-task-card">
                      <div>
                        <strong>{task.title}</strong>
                        <span>{task.userId?.name || task.assignedUserName || "Unknown user"}</span>
                      </div>
                      <div className="progress-task-meta">
                        <span className={`status-pill ${toStatusClass(task.status)}`}>
                          {toStatusLabel(task.status)}
                        </span>
                      </div>
                    </div>
                  ))}
                  {!assignedTasks.length && (
                    <p className="empty-state">No assigned tasks available for progress tracking.</p>
                  )}
                </div>
              </article>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
