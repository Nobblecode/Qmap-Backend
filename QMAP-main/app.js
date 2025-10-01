const express = require("express");
const app = express();

//body parser
const BodyParser = require("body-parser");
app.use(BodyParser.urlencoded({ extended: true, limit: "50mb" }));
app.use(BodyParser.json({ extended: true, limit: "50mb" }));

//cors
const cors = require("cors");
app.use(cors({
  origin: "*",
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
}));

//dotenv
require("dotenv").config();

const Port = process.env.PORT || 4000;

//express-fileupload
const fileUpload = require("express-fileupload");
const os = require("os");
const path = require("path");
const fs = require("fs");

const tmpDir = path.join(os.tmpdir(), "uploads");
fs.mkdirSync(tmpDir, { recursive: true });

app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: tmpDir,
  createParentPath: true,
  limits: { fileSize: 10 * 1024 * 1024 },
  abortOnLimit: true,
}));

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

    // register routes (after DB is ready)
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
    // new endpoints
    app.use(
      "/productowner/wallet",
      require("./routes/productOwner/wallet/Wallet")
    );
    app.use("/affiliate/analytics", require("./routes/affiliate/analytics/Analytics"));
    app.use("/general/wallets", require("./routes/general/wallets/Wallets"));
    app.use("/general/tracking", require("./routes/general/tracking/Tracking"));
    app.use("/general/contact", require("./routes/general/contact/Contact"));

    // admin client management
    app.use('/admin/clients', require('./routes/admin/clients/Clients'));

    // affiliate wallet endpoints
    app.use("/affiliate/wallet/deposit", require("./routes/affiliate/wallet/Deposit"));
    app.use("/affiliate/wallet/withdraw", require("./routes/affiliate/wallet/Withdraw"));
    app.use("/affiliate/wallet", require("./routes/affiliate/wallet/Wallet"));

    //run server
    app.listen(Port, () => console.log(`http://localhost:${Port}`));
  })
  .catch((error) => {
    console.error("Error connecting to the database:", error);
  });
