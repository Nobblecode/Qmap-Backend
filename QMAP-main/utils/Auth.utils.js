const jwt = require("jsonwebtoken");

const crypto = require("crypto");
const AuthModel = require("../models/general/Auth.model");
const ProfileModel = require("../models/user/Profile.model");

function createHash(jsonBody, apiKey) {
  // Convert JSON body to string
  const jsonString = JSON.stringify(jsonBody);

  // Concatenate the JSON string with the API key
  const dataToHash = jsonString + apiKey;

  // Create SHA-512 hash
  const hash = crypto.createHash("sha512").update(dataToHash).digest("hex");

  return hash;
}

function Errordisplay(error) {
  console.log(error); // can be removed
  if (error.message) {
    const msg = error.message.split(":")[2];
    return {
      msg: msg
        ? msg.split(",")[0]
          ? msg
              .split(",")[0]
              .split(" ")
              .find((i) => i == "dup")
            ? "Oops! It seems like the details you provided already exist in our system. Please try again"
            : msg.split(",")[0]
          : "Oops! An error occurred. Please try again"
        : `Issue on our end. Please try again.`,
    };
  } else {
    console.log(error);
    return {
      msg: "Oops! An unexpected error occurred. Please try again later.",
    };
  }
}

/////////////////////Jwt///////////////////

async function CreateJWTToken(payload, TypeOf) {
  try {
    await AuthModel.deleteMany({ UserID: payload._id });
    let token = await jwt.sign({ id: payload._id }, process.env.jwtSecret, {
      expiresIn: "1d",
    });

    let fullName;

    // since product owner or affiliate, use FullName
    if (payload.FullName) {
      fullName = payload.FullName;
    }
    // If admin fallback to Email
    else {
      fullName = payload.Email;
    }

    await AuthModel.create({
      UserID: TypeOf === "Admin" ? "admin" : payload._id,
      Auth: token,
      Name: fullName,
      TypeOf,
    });
    return token;
  } catch (error) {
    throw error;
  }
}

async function VerifyAdminJWTToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ Error: "Authorization token missing or malformed" });
  }

  const token = authHeader.split(" ")[1]; // Extract the token

  jwt.verify(token, process.env.jwtSecret, async (err, decoded) => {
    if (err) {
      return res.status(401).json({ Error: "Invalid or expired token" });
    }

    let GetAuth = await AuthModel.findOne({
      Auth: token,
      UserID: decoded.id,
      TypeOf: "Admin",
    }).lean();

    if (GetAuth) {
      const User = {
        _id: "admin",
        FullName: "QMAP ADMIN",
        Email: process.env.adminEmail,
      };
      req.user = User;
      return next();
    }

    return res
      .status(401)
      .json({ Access: false, Error: "Unauthorized, please log in again" });
  });
}

async function VerifyProductOwnerJWTToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ Error: "Authorization token missing or malformed" });
  }

  const token = authHeader.split(" ")[1]; // Extract the token

  jwt.verify(token, process.env.jwtSecret, async (err, decoded) => {
    if (err) {
      return res.status(401).json({ Error: "Invalid or expired token" });
    }

    let GetAuth = await AuthModel.findOne({
      Auth: token,
      UserID: decoded.id,
      TypeOf: "Product Owner",
    }).lean();

    if (GetAuth) {
      let User = await ProfileModel.findOne({ _id: decoded.id })
        .select("-Password")
        .lean();

      req.user = User;
      return next();
    }

    return res
      .status(401)
      .json({ Access: false, Error: "Unauthorized, please log in again" });
  });
}
 
async function VerifyAffilliateMarketerJWTToken(req, res, next) {
  const authHeader = req.headers.authorization;
 
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res
      .status(401)
      .json({ Error: "Authorization token missing or malformed" });
  }

  const token = authHeader.split(" ")[1]; // Extract the token

  jwt.verify(token, process.env.jwtSecret, async (err, decoded) => {
    if (err) {
      return res.status(401).json({ Error: "Invalid or expired token" });
    }

    let GetAuth = await AuthModel.findOne({
      Auth: token,
      UserID: decoded.id,
      TypeOf: "Affiliate",
    }).lean();

    if (GetAuth) {
      let User = await ProfileModel.findOne({ _id: decoded.id })
        .select("-Password")
        .lean();

      req.user = User;
      return next();
    }

    return res
      .status(401)
      .json({ Access: false, Error: "Unauthorized, please log in again" });
  });
}

module.exports = {
  Errordisplay,
  CreateJWTToken,
  VerifyAdminJWTToken,
  createHash,
  VerifyProductOwnerJWTToken,
  VerifyAffilliateMarketerJWTToken,
};
