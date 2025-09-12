const bcryptjs = require("bcryptjs");
const ProfileModel = require("../../../models/user/Profile.model");
const { CreateJWTToken, Errordisplay } = require("../../../utils/Auth.utils");

let router = require("express").Router();

router.post("/", async (req, res) => {
  try {
    //user input
    let { Email, Password } = req.body;

    let User = await ProfileModel.findOne({
      Email: Email,
      type: "Affiliate",
    });

    if (!User)
      return res
        .status(400)
        .json({ Access: true, Error: "User details not found" });

    // compare password;
    let passwordValid = bcryptjs.compareSync(Password, User.Password);

    //password validation
    if (!passwordValid)
      return res
        .status(400)
        .json({ Access: true, Error: "Incorrect Password" });

    //genterate token
    let Token = await CreateJWTToken(User, "Affiliate");

    res.json({
      Access: true,
      Error: false,
      EmailVerify: false,
      Data: {
        Auth: Token,
        Details: {
          FullName: User.FullName,
          Email: User.Email,
        },
      },
    });
  } catch (error) {
    res.status(400).json({ Access: true, Error: Errordisplay(error).msg });
  }
});

module.exports = router;
