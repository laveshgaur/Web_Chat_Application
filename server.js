const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');

// Fix mongoose strictQuery warning
mongoose.set('strictQuery', false);

// Import models
const User = require('./models/User');
const Message = require('./models/Message');

// Import routes
const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');

// Import database config
const connectDB = require('./config/db');

// Connect to database
connectDB();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({
  secret: 'your_secret_key',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: 'mongodb://localhost:27017/chatapp' }),
  cookie: { maxAge: 60 * 60 * 1000 } // 1 hour
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);

// Socket.io connection
io.on('connection', (socket) => {
  console.log('New client connected');
  
  // Keep track of online users and pending friend requests
  const onlineUsers = new Map();
  
  socket.on('join', (username) => {
    console.log('User joining:', username);
    socket.username = username;
    
    // Add user to online users
    onlineUsers.set(username, socket.id);
    console.log('Online users:', Array.from(onlineUsers.keys()));
    
    socket.broadcast.emit('userJoined', username);
    
    socket.broadcast.emit('message', {
      username: 'System',
      text: `${username} has joined the chat`
    });
  });
  
  socket.on('sendMessage', (message) => {
    io.emit('message', {
      username: socket.username,
      text: message.text,
      timestamp: new Date()
    });
  });
  
  // Handle private messages
  socket.on('sendPrivateMessage', async (data) => {
    const { text, recipient, tempId } = data;
    console.log('Received private message request:', { from: socket.username, to: recipient, text, tempId });
    
    try {
      // Find recipient user from database
      const recipientUser = await User.findOne({ username: recipient });
      if (!recipientUser) {
        console.log('Recipient not found:', recipient);
        socket.emit('messageError', { 
        message: 'Recipient not found',
        tempId: tempId  // Return tempId so client can update the UI
      });
        return;
      }

      // Find sender user from database
      const senderUser = await User.findOne({ username: socket.username });
      if (!senderUser) {
        console.log('Sender not found:', socket.username);
        socket.emit('messageError', { 
        message: 'Sender not found',
        tempId: tempId  // Return tempId so client can update the UI
      });
        return;
      }

      console.log('Found users:', { sender: senderUser.username, recipient: recipientUser.username });

      // Create and save the message
      const newMessage = new Message({
        sender: senderUser._id,
        recipient: recipientUser._id,
        text: text,
        isPrivate: true
      });

      const savedMessage = await newMessage.save();
      await savedMessage.populate('sender', 'username');
      await savedMessage.populate('recipient', 'username');

      console.log('Message saved:', savedMessage);

      // Create the message object for socket
      const messageObj = {
        id: savedMessage._id,
        username: socket.username,
        text: text,
        timestamp: savedMessage.timestamp,
        isPrivate: true
      };
      
      // Get recipient's socket ID from onlineUsers map
      const recipientSocketId = onlineUsers.get(recipient);
      console.log('Recipient socket ID:', recipientSocketId);
      
      // Send to recipient if they're online
      if (recipientSocketId) {
        const recipientSocket = io.sockets.sockets.get(recipientSocketId);
        if (recipientSocket) {
          console.log('Sending message to recipient');
          recipientSocket.emit('privateMessage', messageObj);
        }
      } else {
        console.log('Recipient not online');
      }
      
      // Also send back to sender to confirm delivery
      console.log('Sending confirmation to sender');
      socket.emit('privateMessage', {
        ...messageObj,
        username: socket.username,
        isOwn: true,
        tempId: tempId  // Include tempId to match with pending message
      });
      
      // Send message delivery confirmation
      socket.emit('messageSent', {
        id: savedMessage._id,
        tempId: tempId,  // Include tempId to match with pending message
        status: 'delivered',
        timestamp: new Date()
      });
    } catch (err) {
      console.error('Private message error:', err);
      socket.emit('messageError', { 
        message: 'Failed to send private message',
        tempId: tempId  // Return tempId so client can update the UI
      });
    }
  });
  
  // Handle friend requests
  socket.on('sendFriendRequest', (data) => {
    const { username } = data;
    
    // Find the target socket for the user receiving the request
    const targetSocket = Array.from(io.sockets.sockets.values())
      .find(s => s.username === username);
    
    if (targetSocket) {
      // Send friend request to the target user
      targetSocket.emit('friendRequest', {
        from: socket.username,
        timestamp: new Date()
      });
      
      // Confirm to sender that request was sent
      socket.emit('friendRequestSent', {
        to: username,
        timestamp: new Date()
      });
    }
  });
  
  // Handle friend request acceptance
  socket.on('acceptFriendRequest', (data) => {
    const { username } = data;
    
    // Find the socket of the user who sent the original request
    const requesterSocket = Array.from(io.sockets.sockets.values())
      .find(s => s.username === username);
    
    if (requesterSocket) {
      // Notify requester that their request was accepted
      requesterSocket.emit('friendRequestAccepted', {
        by: socket.username,
        timestamp: new Date()
      });
      
      // Notify both users with system messages
      requesterSocket.emit('message', {
        username: 'System',
        text: `${socket.username} accepted your friend request!`,
        timestamp: new Date()
      });
      
      socket.emit('message', {
        username: 'System',
        text: `You accepted ${username}'s friend request!`,
        timestamp: new Date()
      });
    }
    
    // Broadcast to all users that these two are now friends
    io.emit('newFriendship', {
      users: [socket.username, username],
      timestamp: new Date()
    });
  });
  
  // Handle friend request rejection
  socket.on('rejectFriendRequest', (data) => {
    const { username } = data;
    
    // Find the socket of the user who sent the original request
    const requesterSocket = Array.from(io.sockets.sockets.values())
      .find(s => s.username === username);
    
    if (requesterSocket) {
      // Notify requester that their request was rejected
      requesterSocket.emit('friendRequestRejected', {
        by: socket.username,
        timestamp: new Date()
      });
    }
  });
  
  // Handle adding a user to chat (now happens after friend request is accepted)
  socket.on('addUser', (data) => {
    const { username } = data;
    
    // Notify the added user if they are online
    const targetSocket = Array.from(io.sockets.sockets.values())
      .find(s => s.username === username);
    
    if (targetSocket) {
      targetSocket.emit('message', {
        username: 'System',
        text: `${socket.username} added you to the chat`,
        timestamp: new Date()
      });
    }
    
    // Notify other users about this new addition
    socket.broadcast.emit('message', {
      username: 'System',
      text: `${socket.username} added ${username} to the chat`,
      timestamp: new Date()
    });
  });
  
  socket.on('disconnect', () => {
    if (socket.username) {
      // Remove from online users
      onlineUsers.delete(socket.username);
      console.log(`${socket.username} disconnected. Online users:`, Array.from(onlineUsers.keys()));
      
      // Notify others that user left
      socket.broadcast.emit('userLeft', socket.username);
      
      socket.broadcast.emit('message', {
        username: 'System',
        text: `${socket.username} has left the chat`
      });
    }
    console.log('Client disconnected');
  });
});

// Serve the main HTML file for any other route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));

