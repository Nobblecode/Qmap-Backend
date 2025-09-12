const express = require("express");
const app = express();

//body parser
const BodyParser = require("body-parser");
app.use(BodyParser.urlencoded({ extended: true, limit: "50mb" }));
app.use(BodyParser.json({ extended: true, limit: "50mb" }));

//cors
const cors = require("cors");
app.use(cors());

//dotenv
require("dotenv").config();

const Port = process.env.PORT || 4000;

//express-filupload
const fileUpload = require("express-fileupload");
app.use(fileUpload({ useTempFiles: true }));

// express-session
app.use(
  require("express-session")({
    secret: process.env.SessionSecret,
    resave: true,
    saveUninitialized: true,
    cookie: { expires: 172800000 },
  })
);

//morgan
app.use(require("morgan")("dev"));

// templating
app.set("view engine", "ejs");
app.use(express.static("public"));

//mongoose
const mongoose = require("mongoose");
mongoose.set("strictQuery", true);
mongoose.set("runValidators", true);
mongoose
  .connect(process.env.mongoUri)
  .then(() => {
    console.log("db connected");
  })
  .catch((error) => {
    console.error("Error connecting to the database:", error);
  });

//run server
app.listen(Port, () => console.log(`http://localhost:${Port}`));

app.use("/admin/auth/login", require("./routes/admin/auth/Login"));
app.use(
  "/productowner/auth/register",
  require("./routes/productOwner/auth/Register")
);
app.use(
  "/productowner/auth/login",
  require("./routes/productOwner/auth/Login")
);
app.use(
  "/affiliate/auth/register",
  require("./routes/affiliate/auth/Register")
);
app.use("/affiliate/auth/login", require("./routes/affiliate/auth/Login"));
app.use(
  "/productowner/products",
  require("./routes/productOwner/product/Product")
);
app.use("/product", require("./routes/affiliate/link/Link"));
app.use("/general/products", require("./routes/general/products/Products"));
app.use(
  "/productowner/wallet/deposit",
  require("./routes/productOwner/wallet/Deposit")
);
app.use(
  "/productowner/wallet/withdraw",
  require("./routes/productOwner/wallet/Withdraw")
);
app.use("/webhook", require("./routes/general/Webhook"));
