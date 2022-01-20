const Message = require('../models/Message');
const catchAsync = require('../utils/catchAsync');
const appError = require('../utils/appError')

exports.getAllmessages = catchAsync(async (req, res, next) => {
    const messages = await Message.find({room : req.params.roomId}).populate('sender','firstName lastName picture')
    res.status(200).json({
        status: 'success',
        data: {
            messages
        }
    })
    
})

exports.sendMessage = catchAsync(async (req, res, next) => {

    let newMessage = await Message.create({sender: req.user.id, room: req.params.roomId, content: req.body.content})
    newMessage = await newMessage.populate('sender', 'firstName lastName picture')

    res.status(201).json({
        status: 'succes',
        data: {
            message: newMessage
        }
    })
})