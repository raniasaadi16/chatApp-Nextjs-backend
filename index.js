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

app.enable('trust proxy')
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true
}))
//app.options('*', cors())
app.use(function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type', 'X-HTTP-Method-Override', 'X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', true);
  next();
});
dotenv.config({path: './.env'});
mongoose.connect(process.env.MONGO_URL , 
    {useNewUrlParser: true, 
    useUnifiedTopology: true
}).then(console.log('DB connected ....')).catch(err=> console.log(err));

app.use(express.json());
app.use(cookieParser());

app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);


//ERROR MIDDLEWARE
app.use(errorMiddleware);


const port = process.env.PORT || 5000
const server = app.listen(port, () => {
    console.log(`App listening on port ${port}`);
});


const io = socket(server, { cors:
  {    
    origin: '*'
  }
})
let users = []
const addUser =  (userId, socketId) => {
  !users.some(user => user.userId === userId) && users.push({userId, socketId})
}
const removeUser = (socketId) => {
  users = users.filter(user => user.socketId !== socketId)
}
// const getUser = userId => {
//   return users.find(user => user.userId === userId)
// }
io.on('connection', socket => {
    console.log(socket.id)

    // Add user 
    socket.on('addUser', userId => {
      console.log('userid :', userId)
      addUser(userId, socket.id)
      // Send users
      io.emit('getUsers', users) // send only users of room
    })

    // Get message
    socket.on('sendMessage', ({sender, roomId, content}) => {
     // const user = getUser(senderId)

      //Send it to users
      socket.broadcast.emit('getMessage', { sender, content })
    })

    //disconnect
    socket.on('disconnect', ()=> {
        console.log('dissconnected')
        removeUser(socket.id)
        io.emit('getUsers', users)
    })
})