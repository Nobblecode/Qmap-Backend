const mailer = require("nodemailer");

const myemail = mailer.createTransport({
  service: process.env.service,
  host: process.env.host,
  // port: 465,

  port: 465,

  auth: {
    user: process.env.email,
    pass: process.env.pass,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

async function Sendmail(to, subject, html, many = false) {
  try {
    const mailoption = {
      from: `${process.env.Company} <${process.env.email}>`,
      ...{ bcc: to },
      subject: subject,
      html: html,
    };
    await myemail.sendMail(mailoption);
    return { sent: true };
  } catch (error) {
    console.log(error.message);
    return { error: error.message };
  }
}

module.exports = {
  Sendmail,
};
