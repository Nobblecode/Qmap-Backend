const express = require("express");
const { CreateJWTToken, Errordisplay } = require("../../../utils/Auth.utils");
const AdminBalanceModel = require("../../../models/wallet/admin/AdminBalance.model");
const router = express.Router();

router.post("/", async (req, res) => {
  try {
    //user input
    let { Email, Password } = req.body;
    if (Email !== process.env.adminEmail)
      return res.status(400).json({ Access: true, Error: "Incorrect Email" });

    //password validation
    if (Password !== process.env.adminPassword)
      return res
        .status(400)
        .json({ Access: true, Error: "Incorrect Password" });

    //genterate token
    let Token = await CreateJWTToken(
      { _id: "admin", Email: process.env.adminEmail },
      "Admin"
    );

    const adminBalanceExists = await AdminBalanceModel.find({});
    

    if (adminBalanceExists.length === 0) {
      await AdminBalanceModel.create({
        EarnedBalance: 0,
        TotalClientFunds: 0,
      });
    }

    res.json({
      Access: true,
      Error: false,
      Data: {
        Auth: Token,
        Details: {
          Fullname: "QMAP ADMIN",
          Email: process.env.adminEmail,
        },
      },
    });
  } catch (error) {
    res.status(400).json({ Access: true, Error: Errordisplay(error).msg });
  }
});

module.exports = router;
