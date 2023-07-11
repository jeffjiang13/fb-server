const Message = require('../models/messageModel');
const Chat = require('../models/chatModel');
const mongoose = require('mongoose');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/appError');
const APIFeatures = require('../utils/apiFeatures');
const User = require('../models/userModel');
const Notification = require('../utils/notification');
const { uploadToCloudinary } = require('../utils/cloudinaryHandler');
const ObjectId = mongoose.Types.ObjectId;
const multer = require('multer');
const sharp = require('sharp');


const filterObj = (obj, ...allowed) => {
  const newObj = {};
  Object.keys(obj).forEach((el) => {
    if (allowed.includes(el)) newObj[el] = obj[el];
  });
  return newObj;
};

const multerStorage = multer.memoryStorage();

const multerFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image') || file.mimetype.startsWith('video')) {
    cb(null, true);
  } else {
    cb(new AppError('Please upload only images and video', 400), false);
  }
};

const upload = multer({ storage: multerStorage, fileFilter: multerFilter });
exports.uploadMessageImage = upload.single('image');

exports.processMessageImage = catchAsync(async (req, res, next) => {
  if (!req.file) return next();

  const path = `${process.env.APP_NAME}/users/${req.user.id}/public/messages/`;

  const processedImage = await sharp(req.file.buffer)
    .toFormat('webp')
    .webp({ quality: 70 })
    .toBuffer();

  const filePath = await uploadToCloudinary(processedImage, path);
  // Check if filepath successfully returned
  if(filePath && filePath.url) {
    req.body.image = filePath.url;
    console.log("body",req.body.image);
    next();
  } else {
    res.status(500).json({
      status: 'fail',
      message: 'Error processing image, please try again'
    });
  }
});

exports.sendMessage = catchAsync(async (req, res, next) => {
  const { content, type } = req.body;
  const userId = req.user.id;
  const { chatId } = req.params;

  const existingChat = await Chat.findById(chatId);

  if (!existingChat) return next(new AppError('No chat found', 400));

  const targetId = new ObjectId(userId);
  if (!existingChat.users.some((id) => id.equals(targetId)))
    return next(new AppError('You are not member in this chat', 400));
    const filteredBody = filterObj(req.body, 'image');

  const newMessage = await Message.create({
    type,
    sender: userId,
    content: content,
    chat: chatId,
    image: filteredBody.image,
  });

  await newMessage.save();

  const filteredChat = existingChat;
  filteredChat.users = filteredChat.users.filter((user) => {
    return user._id.toString() !== userId;
  });

  await Promise.all(
    filteredChat.users.map(async (user) => {
      const recipient = await User.findById(user._id.toString()).select(
        'fcmToken username'
      );
      await new Notification({
        recipient: recipient,
        sender: req.user,
        postId: existingChat._id,
        postReact: newMessage.content.slice(0, 10),
      }).sendMessage();
    })
  );

  res.status(200).json({
    status: 'success',
    data: { message: newMessage },
  });
});

exports.getMessages = catchAsync(async (req, res, next) => {
  const userId = req.user.id;
  const { chatId } = req.params;
  const { page } = req.query;
  const existingChat = await Chat.findById(chatId);

  if (!existingChat) return next(new AppError('No chat found', 400));

  const targetId = new ObjectId(userId);
  if (!existingChat.users.some((id) => id.equals(targetId)))
    return next(new AppError('You are not member in this chat', 400));

  let filter = {
    chat: chatId,
  };
  const features = new APIFeatures(
    Message.find(filter).populate({
      path: 'sender seenBy',
      select: 'first_name last_name photo username gender confirmed',
    }),
    req.query
  )
    .filter()
    .sort()
    .limitFields()
    .paginate();
  const messages = await features.query;

  const filteredChat = existingChat;
  filteredChat.users = filteredChat.users.filter((user) => {
    return user._id.toString() !== userId;
  });
  if (filteredChat.type === 'private') {
    filteredChat.photo = filteredChat.users[0].photo;
    filteredChat.chatName = `${filteredChat.users[0].first_name} ${filteredChat.users[0].last_name}`;
  } else if (!filteredChat.photo) {
    filteredChat.photo =
      'https://res.cloudinary.com/dw8k3b8h7/image/upload/v1687285624/group_hjcccf.png';
  }

  res.status(200).json({
    status: 'success',
    length: messages.length,
    data: {
      chat: page == 1 ? existingChat : null,
      messages,
    },
  });
});

exports.seenMessage = catchAsync(async (req, res, next) => {
  const { msgId } = req.params;
  const userId = req.user.id;

  const existingMessage = await Message.findById(msgId);

  if (!existingMessage) return next(new AppError('No message found', 400));

  existingMessage.seen = 'seen';
  if (!existingMessage.seenBy.includes(userId))
    existingMessage.seenBy.push(userId);

  await existingMessage.save();

  res.status(200).json({
    status: 'success',
    data: {
      message: existingMessage,
      unseenMessages: req.user.unseenMessages - 1,
    },
  });
});
