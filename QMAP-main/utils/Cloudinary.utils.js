//cloudinary
const cloudinary = require("cloudinary");
cloudinary.config({
  cloud_name: "loswift",
  api_key: process.env.apiKey,
  api_secret: process.env.apiSecret,
  secure: true,
});

async function uploadimg(file, path) {
  try {
    let files = file ? file : false;
    let paths = path ? path : false;
    if (files != false && paths != false) {
      let upload = await cloudinary.v2.uploader.upload(files.tempFilePath, {
        resource_type: "image",
        folder: paths,
        use_filename: false,
        unique_filename: true,
      });
      return { url: upload.secure_url, publicID: upload.public_id };
    }
    return { error: "Images are missing" };
  } catch (error) {
    console.log(error);
    return { error: error.message };
  }
}

async function deleteImg(publicIDs) {
  try {
    let publicID = publicIDs ? publicIDs : false;
    console.log(publicID);
    if (publicID != false) {
      await cloudinary.v2.uploader.destroy(publicID);
      return { deleted: true };
    }
    return { error: "no file like this" };
  } catch (error) {
    console.log(error);
    return { error: error.message };
  }
}

module.exports = {
  uploadimg,
  deleteImg,
};
