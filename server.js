import cors from "cors";
import { config } from "dotenv";
import cookieParser from "cookie-parser";
import express from "express";
import dbConnection from "./database/dbConnection.js";
import { errorMiddleware } from "./middlewares/error.js";
import router from "./routes/userRouter.js";
import { removeUnverifiedAccounts } from "./automation/removeUnverifiedAccounts.js";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
config({ path: "./config/config.env" });
app.use(
  cors({
    origin: [process.env.FRONTEND_URL],
    methods: ["POST", "GET", "DELETE", "PUT"],
    credentials: true,
  })
);

app.use("/api/v1/user", router);
app.listen(process.env.PORT, () => {
  console.log(`Server running on ${process.env.PORT}.`);
});

removeUnverifiedAccounts();
dbConnection();
app.use(errorMiddleware);
