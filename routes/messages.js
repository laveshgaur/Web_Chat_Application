const express = require('express');
const router = express.Router();
const Message = require('../models/Message');
const User = require('../models/User');

// Middleware to check if user is logged in
const isAuthenticated = (req, res, next) => {
  if (req.session.user) {
    return next();
  }
  res.status(401).json({ message: 'Not authenticated' });
};

// Get all messages (both global and private for the user)
router.get('/', isAuthenticated, async (req, res) => {
  try {
    const userId = req.session.user.id;
    
    // Get both global messages and private messages where user is sender or recipient
    const messages = await Message.find({
      $or: [
        { isPrivate: { $ne: true } }, // Global messages
        { 
          isPrivate: true, 
          $or: [
            { sender: userId },
            { recipient: userId }
          ]
        } // Private messages for this user
      ]
    })
    .populate('sender', 'username')
    .populate('recipient', 'username')
    .sort({ timestamp: 1 });
    
    res.json(messages);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Send a message
router.post('/', isAuthenticated, async (req, res) => {
  const { text, recipient, isPrivate } = req.body;

  try {
    // Create message object
    const messageData = {
      sender: req.session.user.id,
      text,
      isPrivate: isPrivate || false
    };
    
    // If it's a private message, add recipient
    if (isPrivate && recipient) {
      // Find recipient user
      const recipientUser = await User.findOne({ username: recipient });
      
      if (!recipientUser) {
        return res.status(400).json({ message: 'Recipient user not found' });
      }
      
      messageData.recipient = recipientUser._id;
    }

    const newMessage = new Message(messageData);
    const message = await newMessage.save();
    
    // Populate sender and recipient info
    await message.populate('sender', 'username');
    
    if (message.recipient) {
      await message.populate('recipient', 'username');
    }

    res.status(201).json(message);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

module.exports = router;
