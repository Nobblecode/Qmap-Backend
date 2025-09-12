const bcryptjs = require("bcryptjs");
const ProfileModel = require("../../../models/user/Profile.model");
const BalanceModel = require("../../../models/wallet/Balance.model");
const { Errordisplay } = require("../../../utils/Auth.utils");
const { createNotification } = require("../../../utils/Notifications.utils");

let router = require("express").Router();

router.post("/", async (req, res) => {
  try {
    //user input
    let { FullName, Email, Password, Type } = req.body;

    //validate password
    if (!/[^\w\s]/.test(Password || "")) {
      return res.status(500).json({
        Access: true,
        Error: "Password must contain at least one special character.",
      });
    }
    if (Password?.length < 8)
      return res.status(500).json({
        Access: true,
        Error: "Password is too short minimum of 8",
      });
    if (Password?.length > 15)
      return res.status(500).json({
        Access: true,
        Error: "Password is too long maximum of 15",
      });

    //hash password
    Password = bcryptjs.hashSync(Password, 5);

    let NewUser = await ProfileModel.create({
      FullName: FullName,
      Email: Email,
      Password: Password,
      type: Type,
    });

    await BalanceModel.create({ UserID: NewUser._id, TypeOf: "Product Owner" });

    res.json({
      Access: true,
      Error: false,
      Register: true,
      Email: Email,
    });

    //create notication
    const notificationMessage = `Dear ${FullName} Thank you for creating an account qith QMAP. You’re all set to start exploring our affiliate marketing services!`;
    await createNotification(NewUser._id, notificationMessage);

    // await Sendmail(
    //   Email,
    //   "Propfizer email Verified",
    //   `
    //     <!DOCTYPE html>
    //     <html lang="en">
    //     <head>
    //         <meta charset="UTF-8">
    //         <meta name="viewport" content="width=device-width, initial-scale=1.0">
    //         <meta http-equiv="X-UA-Compatible" content="IE=edge">
    //         <style>
    //             body {
    //                 margin: 0;
    //                 padding: 0;
    //                 background-color: #f2f2f2;
    //                 font-family: Arial, sans-serif;
    //             }
    //             table {
    //                 border-spacing: 0;
    //             }
    //             td {
    //                 padding: 0;
    //             }
    //             img {
    //                 border: 0;
    //             }
    //             .email-container {
    //                 width: 100%;
    //                 max-width: 600px;
    //                 margin: 0 auto;
    //                 background-color: #ffffff;
    //                 border-radius: 8px;
    //                 overflow: hidden;
    //                 box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    //             }
    //             .header {
    //                 background-color: #4CAF50;
    //                 color: #ffffff;
    //                 text-align: center;
    //                 padding: 20px;
    //             }
    //             .header h1 {
    //                 margin: 0;
    //             }
    //             .content {
    //                 padding: 20px;
    //                 color: #333333;
    //                 text-align: center;
    //             }
    //             .content h2 {
    //                 color: #4CAF50;
    //                 margin-top: 0;
    //             }
    //             .button {
    //                 display: inline-block;
    //                 padding: 10px 20px;
    //                 background-color: #4CAF50;
    //                 color: #ffffff;
    //                 text-decoration: none;
    //                 border-radius: 5px;
    //                 margin-top: 20px;
    //             }
    //             .footer {
    //                 background-color: #f9f9f9;
    //                 text-align: center;
    //                 padding: 10px;
    //                 font-size: 12px;
    //                 color: #777777;
    //             }
    //             .footer p {
    //                 margin: 5px 0;
    //             }
    //             .footer a {
    //                 color: #4CAF50;
    //                 text-decoration: none;
    //             }
    //             @media (max-width: 600px) {
    //                 .email-container {
    //                     width: 100% !important;
    //                 }
    //             }
    //         </style>
    //     </head>
    //     <body>
    //         <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color: #f2f2f2;">
    //             <tr>
    //                 <td>
    //                     <table class="email-container" role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">
    //                         <!-- Header -->
    //                         <tr>
    //                             <td class="header">
    //                                 <h1>Propfizer</h1>
    //                                 <p>Your Property, Our Priority</p>
    //                             </td>
    //                         </tr>
    //                         <!-- Content -->
    //                         <tr>
    //                             <td class="content">
    //                                 <h2>Email Successfully Verified</h2>
    //                                 <p>Thank you for verifying your email address. You’re all set to start exploring our property management services!</p>
    //                                 <a href="${process.env.websiteLink}" class="button">Go to Dashboard</a>
    //                                 <p>If this wasn’t you, please contact our support immediately.</p>
    //                             </td>
    //                         </tr>
    //                         <!-- Footer -->
    //                         <tr>
    //                             <td class="footer">
    //                                 <p>&copy; 2025 Propfizer. All rights reserved.</p>
    //                                 <p><a href="#">Privacy Policy</a> | <a href="#">Terms of Service</a></p>
    //                             </td>
    //                         </tr>
    //                     </table>
    //                 </td>
    //             </tr>
    //         </table>
    //     </body>
    //     </html>
        
    //     `
    // );
  } catch (error) {
    res.status(400).json({ Access: true, Error: Errordisplay(error).msg });
  }
});

module.exports = router;
