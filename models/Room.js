const mongoose = require('mongoose'); 

// Declare the Schema of the Mongo model
var roomschema = new mongoose.Schema({
    name:{
        type:String,
        required:[true, 'name is required'],
        unique:[true, 'this room already exist !'],
    },
    description:{
        type:String,
        required:true,
    },
    shortName: {
        type: String,
        required: true,
        unique: true
    },
    members: [
        {
            type: mongoose.Schema.ObjectId,
            ref: 'User'
        }
    ]
},
{});

roomschema.pre(/^find/, function(next){
    this.populate({
        path: 'members',
        select: 'firstName lastName picture'
    })
    next()
})

//Export the model
module.exports = mongoose.model('Room', roomschema);