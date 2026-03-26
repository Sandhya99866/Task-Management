const express = require("express");
const { getUsers, getUserById, createUser, loginUser, deleteUser } = require("../controller/userController");
const { authenticate } = require("../middleware/authMiddleware");
const router = express.Router();

router.get("/", authenticate, getUsers);
router.get("/:id", authenticate, getUserById);
router.post("/", createUser);
router.post("/login", loginUser);
router.delete("/:id", authenticate, deleteUser);

module.exports = router;
