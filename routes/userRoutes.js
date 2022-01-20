const express = require('express');
const authController = require('../controllers/authController');
const router = express.Router();
const upload = require('../utils/uploadPhotos')

router.route('/login').post(authController.login); 
router.get('/logout', authController.logout);
router.route('/signup').post(authController.signup);
router.get('/getMe',authController.protect, authController.getMe);
router.patch('/updateMe',authController.protect,upload, authController.updateMe); 
router.delete('/deleteMe',authController.protect, authController.deleteMe);
router.patch('/updatePassword',authController.protect, authController.updatePass); 

router.route('/isLoggedin').get(authController.isLoggedin, authController.getCurrentUser);
router.route('/isLoggedin/:test').get(authController.isLoggedinToken, authController.getCurrentUser);






module.exports = router