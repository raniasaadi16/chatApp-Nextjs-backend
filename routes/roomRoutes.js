const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController')
const authController = require('../controllers/authController')
const messageRoutes = require('./messageRoutes')

router.use('/:roomId/messages', messageRoutes)
router.use(authController.protect)
router.route('/').get(roomController.getAllRooms).post(roomController.createRoom)
router.route('/:id').get(roomController.getRoom).patch(roomController.joinRoom)
router.route('/:id/leave').patch(roomController.leaveRoom)

module.exports = router