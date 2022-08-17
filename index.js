const express = require('express');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const app = express();
const errorMiddleware = require('./utils/errors');
const userRoutes = require('./routes/userRoutes');
const roomRoutes = require('./routes/roomRoutes');
const cookieParser = require('cookie-parser');
const socket = require('socket.io');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const compression = require('compression');

app.use(cookieParser());
app.enable('trust proxy')
app.set('trust proxy', 1)
app.use(cors({
  origin: 'https://chat-app-frontendnext.herokuapp.com',
  credentials: true
}))
//app.options('*', cors())
app.use(function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', 'https://chat-app-frontendnext.herokuapp.com');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type', 'X-HTTP-Method-Override', 'X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', true);
  next();
});
dotenv.config({path: '.env'});
mongoose.connect(process.env.MONGO_URL , 
    {useNewUrlParser: true, 
    useUnifiedTopology: true
}).then(console.log('DB connected ....')).catch(err=> console.log(err));

app.use(express.json({limit: '50mb'}));

// Set security HTTP headers
app.use(helmet());
// Limit requests from same IP
const limiter = rateLimit({
    max: 200,
    windowMs: 60*1000,
    message: 'Too many requests from this IP, please try again in an hour!'
});
app.use('/api', limiter);
app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);

// Data santization against NoSql query injection
app.use(mongoSanitize());
// Data santization against XSS
app.use(xss());
//  prevent paramater pollution
app.use(hpp({
    whitelist: [
      'title', 'content', 'category'
    ]
}));
app.use(compression())

//ERROR MIDDLEWARE
app.use(errorMiddleware);


const port = process.env.PORT || 5000
const server = app.listen(port, () => {
    console.log(`App listening on port ${port}`);
});
process.on('SIGTERM', () => {
  console.log('SIGTERM recieved');
  server.close(() => {
    console.log('Process terminated')
  })
})

const io = socket(server, { cors:
  {    
    origin: '*'
  }
})

// FOR PRODUCTION
// if(process.env.NODE_ENV){
//   app.use(express.static('build'))
//   app.get('*', (req, res)=> {
//     req.sendFile(path.resolve(__dirname, 'build', 'index.html'))
//   })
// }

let users = []

const addUser =  (userId, socketId) => {
  !users.some(user => user.userId === userId) && users.push({userId, socketId})
}
const removeUser = (socketId) => {
  users = users.filter(user => user.socketId !== socketId)
}

io.on('connection', socket => {    
    socket.on('onlineUser', userId => {
      addUser(userId, socket.id)
      io.emit('getUsers', users)
    })


    // Join room
    socket.on('join-room', (roomId) => {
      socket.join(roomId)
    })
    
    //Leave Room
    socket.on('leave-room', (roomId) => {
      socket.leave(roomId)
    })
    

    // Get message
    socket.on('sendMessage', ({sender, roomId, content}) => {
      //Send it to users
      socket.to(roomId).emit('getMessage', { sender, content })
    })

    // if user type
    socket.on('typing', (roomId) => {
      socket.broadcast.to(roomId).emit('is-typing')
    })

    // if user stop typing
    socket.on('stop-typing', (roomId) => {
      socket.broadcast.to(roomId).emit('not-typing')
    })

    // If a new user joined the room
    socket.on('addUserToRoom', (room, roomId)=> {
      // Send the new room members
      socket.to(roomId).emit('getUpdatedRoom', room)
    })

    // If a user leave the room
    socket.on('removeUserFromRoom', (room, roomId)=> {
      // Send the new room members
      socket.to(roomId).emit('getUpdatedRoom', room)
    })


    //disconnect
    socket.on('disconnect', ()=> {
        removeUser(socket.id)
        io.emit('getUsers', users)
    })
})


module.exports = app



