const User = require('../models/User');
const catchAsync = require('../utils/catchAsync');
const appError = require('../utils/appError');
const jwt = require('jsonwebtoken');
const cloudinary = require('../utils/cloudinary');
const { OAuth2Client } = require('google-auth-library')
const dotenv = require('dotenv')
const fetch = require('node-fetch')
dotenv.config({path: '.env'});

const client = new OAuth2Client(process.env.GOOGLE_AUTH_API)

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

//*******************LOGIN*****************/
exports.login = catchAsync(async (req,res,next)=>{
    const {email, password} = req.body;
    if(!email || !password) return next(new appError('you must enter all fields', 400));

    const user = await User.findOne({email}).select('+password');
    // CHECK IF USER EXIST
    if(!user) return next(new appError('email or password wrong', 400));
    // CHECK IF USER HAD SIGNUP WITH OAUTH METHOD
    if(user.authMethod.oAuth && !await user.checkPassword(user.password, password)) return next(new appError(`Please try to login with ${user.authMethod.methodeType}`, 400));
    // CHECK IF USER'S PASSWORD
    if(!user || !await user.checkPassword(user.password, password)) return next(new appError('email or password wrong', 400));
    // REGISTER THE TIME OF LOGIN
    await User.findByIdAndUpdate(user.id,{lastTimeLogedin: Date.now()});
    // LOGIN THE USER WITH NEW TOKEN
    const token = jwt.sign({id: user.id}, process.env.JWT_SECRET);
    const cookieOption = {
        expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN*24*60*60*1000),
        httpOnly: true,
        secure : true,
        sameSite: 'none',
        domain: 'chat-app-frontendnext.herokuapp.com'
    };
   // if(req.secure || req.headers('x-forwarded-proto')=== 'https') cookieOption.secure = true;

    res.cookie('jwt', token, cookieOption);
    res.status(200).json({
        status: 'success',
        data: {
            user
        }
    })

});
//****************LOGIN WITH GOOGLE***********/
exports.googleLogin = catchAsync(async (req, res, next)=> {
    const { tokenId} = req.body
    let user
    const response = await client.verifyIdToken({idToken : tokenId, audience: process.env.GOOGLE_AUTH_API})
    const { email, given_name, family_name, picture, email_verified } = response.payload

    if(!email_verified) return next(new appError('Somehing went very wrong .....!',400))
    user = await User.findOne({email})
    if(user){
        if(!user.authMethod.oAuth) return next(new appError('this email doesnt use a google authentication, please try to login with email and password',400))
        if(user.authMethod.methodeType !== 'Google') return next(new appError(`please try to login with ${user.authMethod.methodeType}`,400))
        // REGISTER THE TIME OF LOGIN
        await User.findByIdAndUpdate(user.id,{lastTimeLogedin: Date.now()});
    }else{
        if(email_verified){
            user = await User.create({
                firstName : given_name, lastName: family_name, password: process.env.JWT_SECRET + Date.now(),passwordConfirm : process.env.JWT_SECRET + Date.now(),email ,picture, authMethod: {oAuth: true, methodeType: 'Google'}
            });
        }
    }

    const token = jwt.sign({id: user.id}, process.env.JWT_SECRET);
    const cookieOption = {
        expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN*24*60*60*1000),
        httpOnly: true,
        //secure : true,
        SameSite: 'None'
    };
    if(req.secure || req.headers('x-forwarded-proto')=== 'https') cookieOption.secure = true;

    res.cookie('jwt', token, cookieOption);
    res.status(200).json({
        status: 'success',
        data: {
            user
        }
    })
})
//****************LOGIN WITH FACEBOOK***********/
exports.facebookLogin = catchAsync(async (req, res, next)=> {
    const { accessToken, userID} = req.body
    let user
    const response = await fetch(`https://graph.facebook.com/v2.11/${userID}?fields=email,first_name,last_name,picture&access_token=${accessToken}`, {
        method: 'GET'
    })
    const data = await response.json()
    user = await User.findOne({email : data.email})
    if(user){
        if(!user.authMethod.oAuth) return next(new appError('this email doesnt use a facebook authentication, please try to login with email and password',400))
        if(user.authMethod.methodeType !== 'Facebook') return next(new appError(`please try to login with ${user.authMethod.methodeType}`,400))
        // REGISTER THE TIME OF LOGIN
        await User.findByIdAndUpdate(user.id,{lastTimeLogedin: Date.now()});
    }else{
        if(response.ok){
            const { first_name, last_name, email, picture } = data
            user = await User.create({
                firstName : first_name, lastName: last_name, password: process.env.JWT_SECRET + Date.now(),passwordConfirm : process.env.JWT_SECRET + Date.now(),email ,picture: picture.data.url, authMethod: {oAuth: true, methodeType: 'Facebook'}
            });
        }
    }

    const token = jwt.sign({id: user.id}, process.env.JWT_SECRET);
    const cookieOption = {
        expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN*24*60*60*1000),
        httpOnly: true,
        //secure : true,
        SameSite: 'None',    };
    if(req.secure || req.headers('x-forwarded-proto')=== 'https') cookieOption.secure = true;

    res.cookie('jwt', token, cookieOption);
    res.status(200).json({
        status: 'success',
        data: {
            user
        }
    })
})
//*******************LOGOUT*****************/
exports.logout = catchAsync(async (req,res,next)=>{
    const cookieOption = {
        expires: new Date(Date.now() + 10*1000),
        httpOnly: true,
        //secure : true,
        SameSite: 'None'
    };
    if(req.secure || req.headers('x-forwarded-proto')=== 'https') cookieOption.secure = true;
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
        //secure : true,
        SameSite: 'None'
    };
    if(req.secure || req.headers('x-forwarded-proto')=== 'https') cookieOption.secure = true;

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
                  
const checkOauthCreatePassword = (user) => {
    return (user.authMethod.oAuth && !user.passwordChangedAt)
}
//*******************UPDATE PASSWORD*****************/
exports.updatePass = catchAsync(async (req,res,next)=>{
    const {currentPass, password, passwordConfirm} = req.body;
    if(!password || !passwordConfirm) return next(new appError('missed field!',400))
    const user = await User.findById(req.user.id).select('+password');
    if(!currentPass && !checkOauthCreatePassword(user)) return next(new appError('missed field!',400))
    // CHECK IF CURRENT PASSWORD FIELD VALUE IS CORRECT
    if(!checkOauthCreatePassword(user)){
        if(!await user.checkPassword(user.password, currentPass)) return next(new appError('wrong current password !',400));
    }

    // UPDATE PASSWORD
    user.password = password;
    user.passwordConfirm = passwordConfirm;   
    await user.save();
    // LOGIN THE USER WITH NEW TOKEN
    const token = jwt.sign({id: user.id}, process.env.JWT_SECRET);
    const cookieOption = {
        expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRES_IN*24*60*60*1000),
        httpOnly: true,
    //    secure : true,
        SameSite: 'None'
    };
    if(req.secure || req.headers('x-forwarded-proto')=== 'https') cookieOption.secure = true;
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
    console.log(req.cookies)
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
    console.log(req.cookies)
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



