const User = require('../models/User');
const catchAsync = require('../utils/catchAsync');
const appError = require('../utils/appError');
const jwt = require('jsonwebtoken');
const cloudinary = require('../utils/cloudinary');

//*******************PROTECT*****************/
exports.protect = catchAsync(async (req,res,next)=>{
    let token;
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];   
    }else if(req.cookies.jwt) {
        token = req.cookies.jwt
    };
    // CHECK IF TOKEN EXIST
    if(!token) return next(new appError('you must loggin',401));
    // CHECK IF TOKEN IS CORRECT
    let decoded;
    jwt.verify(token, process.env.JWT_SECRET,(err,user)=>{
        if(err) return res.status(401).json('token not valid !')
        decoded = user
    });

    // CHECK IF USER STILL EXIST
    const user = await User.findById(decoded.id);
    if(!user) return next(new appError('user no longer exist , please login again', 404));
    
    // CHECK IF PASSWORD WAS CHANGED AFTER THE TOKEN WAS ISSUD
    if(user.passwordChangedAfter(decoded.iat)){
        return next(new appError('User recently changed password! please login again ',401));
    }
    
    req.user = user; 

    next();

});
//*******************ADMIN ACTION*****************/
exports.adminAction = (req,res,next) => {
    if(req.user.role !== 'admin') return next(new appError('you are not authorizate to do that !',401));
    next();
};
//*******************LOGIN*****************/
exports.login = catchAsync(async (req,res,next)=>{
    const {email, password} = req.body;
    if(!email || !password) return next(new appError('you must enter all fields', 400));

    const user = await User.findOne({email}).select('+password');
    // CHECK IF USER HAD SIGNUP WITH OAUTH METHOD
    // CHECK IF USER EXIST
    if(!user || !await user.checkPassword(user.password, password)) return next(new appError('email or password wrong', 400));
    // REGISTER THE TIME OF LOGIN
    await User.findByIdAndUpdate(user.id,{lastTimeLogedin: Date.now()});
    // LOGIN THE USER WITH NEW TOKEN
    const token = jwt.sign({id: user.id}, process.env.JWT_SECRET);
    const cookieOption = {
        expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN*24*60*60*1000),
        httpOnly: true,
       // secure : true,
    };
    //if(req.secure || req.headers('x-forwarded-proto')=== 'https') cookieOption.secure = true;

    res.cookie('jwt', token, cookieOption);
    res.status(200).json({
        status: 'success',
        data: {
            user
        }
    })

});
//****************LOGIN WITH GOOLE***********/
exports.googleLogin = catchAsync(async (req, res, next)=> {})
//*******************LOGOUT*****************/
exports.logout = catchAsync(async (req,res,next)=>{
    const cookieOption = {
        expires: new Date(Date.now() + 10*1000),
        httpOnly: true,
       // secure : true,
    };
    //if(req.secure || req.headers('x-forwarded-proto')=== 'https') cookieOption.secure = true;
    res.cookie('jwt', 'logout', cookieOption);
    res.status(200).json({status: 'success', data: {}})
})  
//*******************SINGUP*****************/
exports.signup = catchAsync(async (req,res,next)=>{
    const { firstName, lastName, password, passwordConfirm, email} = req.body;
    const user = await User.create({
        firstName,lastName,password,passwordConfirm,email
    });
    const token = jwt.sign({id: user.id}, process.env.JWT_SECRET);
    const cookieOption = {
        expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN*24*60*60*1000),
        httpOnly: true,
        secure : true,
    };
    //if(req.secure || req.headers('x-forwarded-proto')=== 'https') cookieOption.secure = true;

    res.cookie('jwt', token, cookieOption);
    res.status(201).json({
        status: 'success',
        message:'user signup successfully',
        data: {
            user
        }
    })
    
    
});
//*******************FILTER OBJ FUNCTION*****************/
const filterObj = (obj, ...allowedFields) => {
    const newObj = {};
    Object.keys(obj).forEach(el => {
      if(allowedFields.includes(el)) newObj[el] = obj[el];
    });
    return newObj
};
//*******************GET ME*****************/
exports.getMe = catchAsync(async (req,res,next)=>{
    const user = await User.findById(req.user.id);
    res.status(200).json({
        status: 'success',
        data: user
    })
});
//*******************DELETE ME*****************/
exports.deleteMe = catchAsync(async (req,res,next)=>{
    const {password} = req.body;
    if(!password) return next(new appError('you must enter your password!',400));
    const user = await User.findById(req.user.id).select('+password');
    // CHECK IF PASSWORD IS CORRECT
    if(!await user.checkPassword(user.password, password)) return next(new appError('wrong password!',400));
    // DELETE USER
    await user.remove();

    res.status(204).json({
        status: 'success',
        data: null
    });
});
//*******************UPDATE ME*****************/
exports.updateMe = catchAsync(async (req,res,next)=>{
    // ALLOWED FIELDS
    const fields = filterObj(req.body,'firstName', 'lastName','email','about');
    if(req.body.password || req.body.passwordConfirm) return next(new appError('this route is not for updating your password!',400));
    try{
        if(req.file){
            const result = await cloudinary.uploader.upload(req.file.path, {
                folder: 'chat_app',
                use_filename: true
            });
            fields.picture = result.secure_url;
        }
    }catch(err){
        console.log(err)
    }
    // UPDATE USER DATA
    const user = await User.findByIdAndUpdate(req.user.id, fields, {
        new: true,
        runValidators: true
    });
    res.status(200).json({
        status: 'success',
        message: 'informations updated succussfully',
        data: {
            user
        }
    })
});
//*******************UPDATE PASSWORD*****************/
exports.updatePass = catchAsync(async (req,res,next)=>{
    const {currentPass, password, passwordConfirm} = req.body;
    if(!currentPass || !password || !passwordConfirm) return next(new appError('missed field!',400))
    const user = await User.findById(req.user.id).select('+password');
    // CHECK IF CURRENT PASSWORD FIELD VALUE IS CORRECT
    if(!await user.checkPassword(user.password, currentPass)) return next(new appError('wrong current password !',400));

    // UPDATE PASSWORD
    user.password = password;
    user.passwordConfirm = passwordConfirm;   
    await user.save();
    // LOGIN THE USER WITH NEW TOKEN
    const token = jwt.sign({id: user.id}, process.env.JWT_SECRET);
    const cookieOption = {
        expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN*24*60*60*1000),
        httpOnly: true,
        secure : true
    };
    //if(req.secure || req.headers('x-forwarded-proto')=== 'https') cookieOption.secure = true;
    res.cookie('jwt', token, cookieOption);

    res.status(200).json({
        status: 'success',
        message: 'password updated successfully',
        data: {
            user
        }
    })
});
//*******************IS LOGGEDIN Token*****************/
exports.isLoggedinToken = async (req,res,next)=>{
    if (req.params.test) {
        try {
            // 1) verify token
            let decoded;
            jwt.verify(req.params.test, process.env.JWT_SECRET,(err,user)=>{
                if(err) return next();
                decoded = user
            });
            
            // 2) Check if user still exists
            const currentUser = await User.findById(decoded.id);
            if (!currentUser) {
                return next();
            }

            // 3) Check if user changed password after the token was issued
            if (currentUser.passwordChangedAfter(decoded.iat)) {
                return next();
            }

            // THERE IS A LOGGED IN USER
            req.user = currentUser;
            return next();
        } catch (err) {
            return next();
        }
    }
    next();
};

//*******************IS LOGGEDIN*****************/
exports.isLoggedin = async (req,res,next)=>{
    if (req.cookies.jwt) {
        try {
            // 1) verify token
            let decoded;
            jwt.verify(req.cookies.jwt, process.env.JWT_SECRET,(err,user)=>{
                if(err) return next();
                decoded = user
            });
            
            // 2) Check if user still exists
            const currentUser = await User.findById(decoded.id);
            if (!currentUser) {
                return next();
            }

            // 3) Check if user changed password after the token was issued
            if (currentUser.passwordChangedAfter(decoded.iat)) {
                return next();
            }

            // THERE IS A LOGGED IN USER
            req.user = currentUser;
            return next();
        } catch (err) {
            return next();
        }
    }
    next();
};

exports.getCurrentUser = catchAsync(async (req,res,next)=>{
    if(req.user){
        res.status(200).json({
            data:{
                user: req.user,
                isAuth: true
            }
        })
    }else{
        res.status(200).json({
            data: {
                user: null,
                isAuth: false
            }
        })
    }
})



