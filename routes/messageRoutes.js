const express = require('express');
const router = express.Router({ mergeParams: true});
const messageController = require('../controllers/messageController')
const authController = require('../controllers/authController')

router.use(authController.protect)
router.route('/').get(messageController.getAllmessages).post(messageController.sendMessage)

module.exports = router