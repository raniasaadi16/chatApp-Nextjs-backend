const mongoose = require('mongoose'); 
const bcrypt = require('bcryptjs');
const validator = require('validator');


// Declare the Schema of the Mongo model
var userSchema = new mongoose.Schema({
    firstName:{
        type:String,
        required:[true,'you must enter a your first name']
    },
    lastName:{
        type:String,
        required:[true,'you must enter a your last name']
    },
    email:{
        type:String,
        required:[true, 'you must enter your email'],
        unique:[true, 'there is another account with this email'],
        validate: [validator.isEmail, 'you must enter a valid email']
    },
    picture:{
        type:String,
        default: 'https://res.cloudinary.com/ddu6qxlpy/image/upload/v1627168233/iafh6yj3q0bdpthswtu3.jpg'
    },
    password:{
        type:String,
        required:[true,'you must enter the password'],
        select: false
    },
    passwordConfirm:{
        type:String,
        required:[true,'you must enter the password confirm field'],
    },
    authMethod: {
        oAuth: {
            type: Boolean,
            default: false
        },
        methodeType: String
    },
    passwordChangedAt: Date,
});

// CHECK IF PASSWORD CONFIRM IS THE SAME WITH PASSWORD
userSchema.path('passwordConfirm').validate(function(el) {
    return el === this.password
},'Passwords are not the same')
// PRE MIDDLEWARE FOR CRYPTYNG PASS BEFORE SAVE IT
userSchema.pre('save', async function(next){
    // if we modifie other data , is not neccesary to crypt the password again
    if(!this.isModified('password')) return next(); 
    this.password = await bcrypt.hash(this.password, 12);
    this.passwordConfirm = undefined;
    next();
})
// PRE MIDDLEWARE FOR ADD PASSWORDCHANGEDAT IN CASE OF UPDATYNG PASS
userSchema.pre('save', function(next){
    if(!this.isModified('password') || this.isNew) return next();
    this.passwordChangedAt = Date.now() - 1000;
    next();
})
// INSTENSE METHOD FOR CHECK IF PASS IS CORRECT (I USE IT IN LOGIN CONTROLLER)
userSchema.methods.checkPassword = async (realPass, userPass)=>{
    return await bcrypt.compare(userPass, realPass)
}
// CHECK IF PASSWORD CHANGED AFTER THE TOKEN ISSUED
// jwt iat : Issued at , Identifies the time at which the JWT was issued
userSchema.methods.passwordChangedAfter = function(JWTiat){
    if(this.passwordChangedAt){
        const userpaswordchangedat = parseInt(this.passwordChangedAt.getTime() / 1000,10);
        return userpaswordchangedat > JWTiat;
    }
    return false;
}


module.exports = mongoose.model('User', userSchema);