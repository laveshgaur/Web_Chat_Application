const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Register user
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;

  try {
    // Check if user already exists
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Create new user
    user = new User({
      username,
      email,
      password
    });

    await user.save();

    // Create token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      'your_jwt_secret',
      { expiresIn: '1h' }
    );

    // Set session
    req.session.user = {
      id: user.id,
      username: user.username
    };

    res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Login user
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Create token
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      'your_jwt_secret',
      { expiresIn: '1h' }
    );

    // Set session
    req.session.user = {
      id: user.id,
      username: user.username
    };

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email
      }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Get current user
router.get('/user', (req, res) => {
  if (req.session.user) {
    return res.json({ user: req.session.user });
  }
  res.status(401).json({ message: 'Not authenticated' });
});

// Logout user
router.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: 'Logout failed' });
    }
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out successfully' });
  });
});

// Search users by username
router.get('/users/search', async (req, res) => {
  try {
    const { username } = req.query;
    
    if (!username) {
      return res.status(400).json({ message: 'Username query parameter is required' });
    }
    
    // Search for users whose username contains the search term (case-insensitive)
    const users = await User.find({
      username: { $regex: username, $options: 'i' }
    }).limit(10).select('username email');
    
    res.json(users);
  } catch (err) {
    console.error('User search error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Send friend request
router.post('/friend-request/send/:userId', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const targetUser = await User.findById(req.params.userId);
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Check if request already exists
    const existingRequest = targetUser.friendRequests.find(
      request => request.from.toString() === req.session.user.id
    );

    if (existingRequest) {
      return res.status(400).json({ message: 'Friend request already sent' });
    }

    // Add friend request
    targetUser.friendRequests.push({
      from: req.session.user.id,
      status: 'pending'
    });

    await targetUser.save();

    res.json({ message: 'Friend request sent successfully' });
  } catch (err) {
    console.error('Send friend request error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Accept friend request
router.post('/friend-request/accept/:userId', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const currentUser = await User.findById(req.session.user.id);
    const requestingUser = await User.findById(req.params.userId);

    if (!requestingUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Find the friend request
    const requestIndex = currentUser.friendRequests.findIndex(
      request => request.from.toString() === req.params.userId && request.status === 'pending'
    );

    if (requestIndex === -1) {
      return res.status(404).json({ message: 'Friend request not found' });
    }

    // Update request status
    currentUser.friendRequests[requestIndex].status = 'accepted';

    // Add users to each other's friends lists
    if (!currentUser.friends.includes(req.params.userId)) {
      currentUser.friends.push(req.params.userId);
    }
    if (!requestingUser.friends.includes(currentUser._id)) {
      requestingUser.friends.push(currentUser._id);
    }

    await Promise.all([
      currentUser.save(),
      requestingUser.save()
    ]);

    res.json({ message: 'Friend request accepted' });
  } catch (err) {
    console.error('Accept friend request error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get friend requests
router.get('/friend-requests', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const user = await User.findById(req.session.user.id)
      .populate('friendRequests.from', 'username email');

    const pendingRequests = user.friendRequests.filter(request => request.status === 'pending');

    res.json(pendingRequests);
  } catch (err) {
    console.error('Get friend requests error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get friends list
router.get('/friends', async (req, res) => {
  try {
    if (!req.session.user) {
      return res.status(401).json({ message: 'Not authenticated' });
    }

    const user = await User.findById(req.session.user.id)
      .populate('friends', 'username email');

    res.json(user.friends);
  } catch (err) {
    console.error('Get friends error:', err.message);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
