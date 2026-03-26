const express = require("express");
const cors = require("cors");
const { connectDB } = require("./models/userModel");
const userRoutes = require("./routes/userRoutes");
const app = express();
app.use(cors());
app.use(express.json());
app.use("/users", userRoutes);

connectDB();

app.listen(process.env.PORT || 3001, () => {
  console.log("User service listening on port", process.env.PORT || 3001);
});