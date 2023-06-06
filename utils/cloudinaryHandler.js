const cloudinary = require('cloudinary');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

exports.uploadToCloudinary = async (file, path, resourceType = "image") => {
  return new Promise((resolve, reject) => {
    if (file) {
      cloudinary.v2.uploader
        .upload_stream({ resource_type: resourceType, folder: path },
          function (error, result) {
            if (error) reject(error);
            else resolve(result);
          }
        )
        .end(file);
    } else {
      resolve(null);
    }
  });
};



exports.getImages = async (path, max, sort) => {
  return new Promise((resolve, reject) => {
    cloudinary.v2.search
      .expression(`${path}`)
      .sort_by('created_at', `${sort}`)
      .max_results(max)
      .execute()
      .then((res) => {
        resolve(res);
      })
      .catch((err) => {
        reject(err);
      });
  });
};
exports.getVideos = async (path, max, sort) => {
  return new Promise((resolve, reject) => {
    cloudinary.v2.search
      .expression(`${path}`)
      .resource_type("video")
      .sort_by('created_at', `${sort}`)
      .max_results(max)
      .execute()
      .then((res) => {
        resolve(res);
      })
      .catch((err) => {
        reject(err);
      });
  });
};
