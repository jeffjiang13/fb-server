const User = require('../models/userModel');  // Adjust this according to your actual photo model
const catchAsync = require('../utils/catchAsync');

exports.getPhotos = catchAsync(async (req, res, next) => {
    const { username } = req.params;

    const user = await User.findOne({ username });

    if (!user) {
      return next(new AppError('No user found with that username', 404));
    }

    const path = `${process.env.APP_NAME}/users/${user.id}/public/*`;
    const photos = await getImages(path, 100, 'desc');
    const resources = photos.resources.map((photo) => {
      return { url: photo.secure_url, id: photo.asset_id };
    });
    const profilePhotos = photos.resources
      .filter(
        (photo) =>
          photo.folder ===
          `${process.env.APP_NAME}/users/${user.id}/public/profile_photos`
      )
      .map((photo) => {
        return { url: photo.secure_url, id: photo.asset_id };
      });

    const profileCovers = photos.resources
      .filter(
        (photo) =>
          photo.folder ===
          `${process.env.APP_NAME}/users/${user.id}/public/profile_covers`
      )
      .map((photo) => {
        return { url: photo.secure_url, id: photo.asset_id };
      });

    res.status(200).json({
      status: 'success',
      data: {
        total_count: photos.total_count,
        resources,
        profilePhotos,
        profileCovers,
      },
    });
  });
