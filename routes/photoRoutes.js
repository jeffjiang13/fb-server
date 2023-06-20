const express = require('express');

const authController = require('../controllers/authController');
const photoController = require('../controllers/photoController');

const router = express.Router();

// PROTECT ALL ROUTES AFTER THIS MIDDLEWARE
router.use(authController.protect);

router.get('/allphotos/:userId', photoController.getPhotos);

module.exports = router;
