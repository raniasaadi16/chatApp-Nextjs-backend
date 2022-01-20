const mongoose = require('mongoose'); 

// Declare the Schema of the Mongo model
var messageSchema = new mongoose.Schema({
    content:{
        type:String,
        required:true,
    },
    sender:{
        type: mongoose.Schema.ObjectId,
        required:true,
        ref: 'User'
    },
    room:{
        type: mongoose.Schema.ObjectId,
        required:true,
        ref: 'Room'
    }
},{ timestamps: true });

//Export the model
module.exports = mongoose.model('Message', messageSchema);  