const Room = require('../models/Room');
const catchAsync = require('../utils/catchAsync');
const appError = require('../utils/appError')

exports.getAllRooms = catchAsync(async (req, res, next) =>{
    const rooms = await Room.find();
    res.status(200).json({
        status: 'success',
        data: {
            result: rooms.length,
            rooms
        }
    })
})

exports.createRoom = catchAsync(async (req, res, next) =>{
    const { name, description, shortName } = req.body;
    if(!name || !description || !shortName) return next(new appError('missed fields !', 400))

    const room = await Room.create({name , description, shortName, members: [req.user._id], description})

    res.status(201).json({
        status: 'success',
        data: {
            room 
        }
    })
})

exports.getRoom = catchAsync(async (req, res, next) => {
    const room = await Room.findById(req.params.id).populate('members', 'fisrtName lastName picture')
    if(!room) return next(new appError('no room with this id!', 404))
    res.status(200).json({
        status: 'success',
        members: room.members.length,
        data: {
            room
        }
    })
})

exports.joinRoom = catchAsync(async (req, res, next) => {
    const room = await Room.findById(req.params.id)
    if(!room) return next(new appError('no room with this id!', 404))

    if(room.members.some(member => member.id === req.user.id)) {
        return res.status(200).json({
            staus: 'success',
            message: 'you are already joined this room',
            data: {
                joined: true
            }
        })
    }


    const updatedRoom = await Room.findByIdAndUpdate(req.params.id,{ members: [...room.members, req.user._id]}, {new: true, runValidators: true})
    res.status(200).json({
        status: 'success',
        message: `${req.user.firstName} join ${updatedRoom.name} succussfully`,
        data: {
            updatedRoom
        }
    })
})

exports.leaveRoom = catchAsync(async (req, res, next) => {
    const room = await Room.findById(req.params.id)
    if(!room) return next(new appError('no room with this id!', 404))

    if(!room.members.some(member => member.id === req.user.id)) {
        return res.status(200).json({
            staus: 'success',
            message: 'you are not a member of this room',
            data: {
                joined: true
            }
        })
    }

    const updatedRoom = await Room.findByIdAndUpdate(req.params.id,{ members: room.members.filter(member => member.id !== req.user.id)}, {new: true, runValidators: true})
    res.status(200).json({
        status: 'success',
        message: `${req.user.firstName} unjoin ${updatedRoom.name} succussfully`,
        data: {
            updatedRoom
        }
    })
})