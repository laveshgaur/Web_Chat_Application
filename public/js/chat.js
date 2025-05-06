document.addEventListener('DOMContentLoaded', () => {
    const messagesContainer = document.getElementById('chat-messages');
    const messageInput = document.getElementById('message-input');
    const sendBtn = document.getElementById('send-btn');
    const usernameElement = document.getElementById('username');
    const logoutBtn = document.getElementById('logout-btn');
    const usersList = document.getElementById('users-list');
    const emojiBtn = document.querySelector('.emoji-btn');
    const userSearchInput = document.getElementById('user-search');
    const searchBtn = document.getElementById('search-btn');
    const searchResults = document.getElementById('search-results');
    const chatHeader = document.querySelector('.chat-header h2'); // For updating chat header
    const pendingRequestsContainer = document.getElementById('pending-requests');
    
    // Helper function to format message text with emojis
    const formatMessageText = (text) => {
      // Simple emoji conversion
      const emoticons = {
        ':)': '😊',
        ':-)': '😊',
        ':(': '😞',
        ':-(': '😞',
        ':D': '😃',
        ':-D': '😃',
        ';)': '😉',
        ';-)': '😉',
        ':P': '😋',
        ':-P': '😋',
        '<3': '❤️',
        ':heart:': '❤️',
        ':thumbsup:': '👍',
        ':thumbsdown:': '👎'
      };
      
      let formattedText = text;
      Object.keys(emoticons).forEach(emoticon => {
        formattedText = formattedText.replace(
          new RegExp(emoticon.replace(/([.*+?^=!:${}()|[\]\\])/g, "\\$1"), 'g'),
          emoticons[emoticon]
        );
      });
      return formattedText;
    };
    
    // Online users tracking
    const onlineUsers = new Map();
    const addedUsers = new Set(); // Track users already added to chat list
  
    // Private chat tracking
    let activeChat = {
      type: 'global',
      recipient: null
    };
    
    // Store messages by chat
    const chatMessages = {
      global: []
    };
  
    // Check if user is logged in
    const user = JSON.parse(localStorage.getItem('user'));
    const token = localStorage.getItem('token');
  
    if (!user || !token) {
      window.location.href = '/index.html';
      return;
    }
  
    usernameElement.textContent = user.username;
    addedUsers.add(user.username); // Add current user to the added users set
  
    // Connect to Socket.io
    const socket = io();
  
    // Join the chat
    socket.emit('join', user.username);
    
    // Add self to online users
    onlineUsers.set(user.username, {
      id: user.id,
      username: user.username,
      isCurrentUser: true
    });
    
    // Update users list UI
    const updateUsersList = () => {
      usersList.innerHTML = '';
      
      // Convert map to array and sort
      const users = Array.from(onlineUsers.values()).sort((a, b) => {
        // Current user at the top
        if (a.isCurrentUser) return -1;
        if (b.isCurrentUser) return 1;
        
        // Otherwise sort alphabetically
        return a.username.localeCompare(b.username);
      });
      
      users.forEach(user => {
        const userEl = document.createElement('div');
        userEl.classList.add('user-item');
        
        // Mark active chat user
        if (activeChat.type === 'private' && activeChat.recipient === user.username) {
          userEl.classList.add('active-chat');
        }
        
        // Get initials for avatar
        const initials = user.username.charAt(0).toUpperCase();
        
        userEl.innerHTML = `
          <div class="user-avatar">${initials}</div>
          <span>${user.username}</span>
          <span class="status-indicator online"></span>
          ${user.isCurrentUser ? '<span style="font-size: 0.8em; margin-left: 5px;">(you)</span>' : ''}
        `;
        
        // Add click event to start private chat (except for current user)
        if (!user.isCurrentUser) {
          userEl.addEventListener('click', () => {
            startPrivateChat(user.username);
          });
        }
        
        usersList.appendChild(userEl);
      });
    };
  
    // Start private chat with a user
    const startPrivateChat = (username) => {
      // If we're already in this chat, do nothing
      if (activeChat.type === 'private' && activeChat.recipient === username) {
        return;
      }
      
      // Update active chat
      activeChat = {
        type: 'private',
        recipient: username
      };
      
      // Make sure we have a message store for this chat
      if (!chatMessages[`private_${username}`]) {
        chatMessages[`private_${username}`] = [];
      }
      
      console.log(`Starting private chat with ${username}`);
      console.log(`Chat store exists: ${!!chatMessages[`private_${username}`]}`);
      console.log(`Messages in store: ${chatMessages[`private_${username}`].length}`);
      
      // Clear any new message indicator
      const userItems = Array.from(usersList.querySelectorAll('.user-item'));
      const userItem = userItems.find(el => {
        const spanText = el.querySelector('span')?.textContent;
        return spanText === username;
      });
      
      if (userItem) {
        userItem.classList.remove('has-new-message');
        const dot = userItem.querySelector('.notification-dot');
        if (dot) {
          userItem.removeChild(dot);
        }
      }
      
      // Clear messages container
      messagesContainer.innerHTML = '';
      
      // Load existing private messages
      chatMessages[`private_${username}`].forEach(msg => {
        displayMessage(msg, null, false);
      });
      
      // Update UI
      updateActiveChatUI();
      
      // Scroll to bottom
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    };
    
    // Switch to global chat
    const switchToGlobalChat = () => {
      activeChat = {
        type: 'global',
        recipient: null
      };
      updateActiveChatUI();
    };
    
    // Update UI based on active chat
    const updateActiveChatUI = () => {
      // Update chat header
      if (activeChat.type === 'global') {
        chatHeader.textContent = 'Global Chat';
      } else {
        chatHeader.textContent = `Chat with ${activeChat.recipient}`;
      }
      
      // Clear messages container
      messagesContainer.innerHTML = '';
      
      // Load appropriate messages
      const chatKey = activeChat.type === 'global' ? 'global' : `private_${activeChat.recipient}`;
      chatMessages[chatKey].forEach(message => {
        displayMessage(message, null, false); // Don't scroll on each message
      });
      
      // Update user list to highlight active chat
      updateUsersList();
      
      // Scroll to bottom
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    };
  
    // Display a message in the chat
    const displayMessage = (message, id = null, scroll = true) => {
      console.log('Displaying message:', message);
      const messageEl = document.createElement('div');
      messageEl.classList.add('message');
      
      if (message.isOwn || message.username === user.username) {
        messageEl.classList.add('own-message');
      }
      
      if (message.isPrivate) {
        messageEl.classList.add('private-message');
      }
      
      if (message.pending) {
        messageEl.classList.add('pending-message');
      }
      
      if (message.isError) {
        messageEl.classList.add('error-message');
      }
      
      if (id) {
        messageEl.setAttribute('data-id', id);
      }
      
      const time = new Date(message.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      });
      
      messageEl.innerHTML = `
        <div class="message-header">
          <span class="username">${message.username}</span>
          <span class="time">${time}</span>
          ${message.isPrivate ? '<span class="private-indicator">Private</span>' : ''}
          ${message.pending ? '<span class="pending-indicator">Sending...</span>' : ''}
        </div>
        <div class="message-content">
          ${formatMessageText(message.text)}
        </div>
      `;
      
      messagesContainer.appendChild(messageEl);
      
      // Always scroll for new messages
      if (scroll) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    };
  
    // Load previous messages
    const loadMessages = async () => {
      try {
        // Show loading message
        const loadingMsg = document.createElement('div');
        loadingMsg.classList.add('message', 'system-message');
        loadingMsg.textContent = 'Loading messages...';
        messagesContainer.appendChild(loadingMsg);
        
        // Get messages from server
        const response = await fetch('/api/messages', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to load messages');
        }
  
        const messages = await response.json();
        
        // Remove loading message
        messagesContainer.removeChild(loadingMsg);
        
        if (messages.length === 0) {
          // Show welcome message if no previous messages
          const welcomeMsg = {
            username: 'System',
            text: `Welcome to the chat, ${user.username}! This is the beginning of the conversation.`,
            timestamp: new Date()
          };
          displayMessage(welcomeMsg);
          chatMessages.global.push(welcomeMsg);
        } else {
          messages.forEach(message => {
            // Add user to online users list if not already there
            if (!onlineUsers.has(message.sender.username) && message.sender.username !== 'System') {
              onlineUsers.set(message.sender.username, {
                id: message.sender._id,
                username: message.sender.username,
                isCurrentUser: message.sender.username === user.username
              });
            }
            
            const msgObj = {
              username: message.sender.username,
              text: message.text,
              timestamp: new Date(message.timestamp)
            };
            
            // Determine which chat this belongs to
            if (message.isPrivate && message.recipient) {
              const otherUser = message.sender.username === user.username 
                ? message.recipient.username 
                : message.sender.username;
              
              // Initialize private chat message store if needed
              if (!chatMessages[`private_${otherUser}`]) {
                chatMessages[`private_${otherUser}`] = [];
              }
              
              chatMessages[`private_${otherUser}`].push(msgObj);
            } else {
              // Add to global chat
              chatMessages.global.push(msgObj);
              displayMessage(msgObj);
            }
          });
        }
        
        // Update users list
        updateUsersList();
  
        // Scroll to the bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      } catch (err) {
        console.error('Error loading messages:', err);
        
        // Remove loading message and show error
        messagesContainer.removeChild(loadingMsg);
        const errorMsg = {
          username: 'System',
          text: 'Failed to load messages. Please try refreshing the page.',
          timestamp: new Date()
        };
        displayMessage(errorMsg);
        chatMessages.global.push(errorMsg);
      }
    };
  
    loadMessages();
  
    // Listen for private messages
    socket.on('privateMessage', (message) => {
      console.log('Received private message:', message);
      
      // Add to chat messages regardless of whether it's our own message or not
      const chatKey = `private_${message.username}`;
      if (!chatMessages[chatKey]) {
        chatMessages[chatKey] = [];
      }
      chatMessages[chatKey].push(message);
      
      // If we're in the chat with this user, display the message immediately
      if (activeChat.type === 'private' && activeChat.recipient === message.username) {
        displayMessage(message);
        // Scroll to the new message
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      } else if (!message.isOwn) {
        // Show notification for messages from others when not in their chat
        const userItems = Array.from(usersList.querySelectorAll('.user-item'));
        const userItem = userItems.find(el => {
          const spanText = el.querySelector('span')?.textContent;
          return spanText === message.username;
        });
        
        if (userItem) {
          userItem.classList.add('has-new-message');
          // Add notification dot if not already present
          if (!userItem.querySelector('.notification-dot')) {
            const notificationDot = document.createElement('span');
            notificationDot.classList.add('notification-dot');
            userItem.appendChild(notificationDot);
          }
        }
      }
    });
    
    // Listen for message delivery confirmation
    socket.on('messageSent', (response) => {
      console.log('Message sent confirmation:', response);
      
      if (response.tempId) {
        // Find the message in DOM and update its status
        const pendingMsg = document.querySelector(`.message[data-id="${response.tempId}"]`);
        if (pendingMsg) {
          const statusIndicator = pendingMsg.querySelector('.pending-indicator');
          if (statusIndicator) {
            statusIndicator.textContent = 'Delivered';
            statusIndicator.classList.remove('pending-indicator');
            statusIndicator.classList.add('delivered-indicator');
          }
        }
        
        // Also update in our messages store
        for (const key in chatMessages) {
          const index = chatMessages[key].findIndex(msg => msg.tempId === response.tempId);
          if (index !== -1) {
            chatMessages[key][index].pending = false;
            chatMessages[key][index].delivered = true;
            break;
          }
        }
      }
    });

    // Listen for message errors
    socket.on('messageError', (error) => {
      console.error('Message error:', error);
      
      // Create error message
      const errorMsg = {
        username: 'System',
        text: `Error: ${error.message}`,
        timestamp: new Date(),
        isError: true
      };
      
      // Display and store in current chat
      displayMessage(errorMsg);
      
      // If there's a temp message ID, find and update it to show error
      if (error.tempId && activeChat.type === 'private') {
        const chatKey = `private_${activeChat.recipient}`;
        if (chatMessages[chatKey]) {
          const tempIndex = chatMessages[chatKey].findIndex(msg => msg.tempId === error.tempId);
          if (tempIndex !== -1) {
            chatMessages[chatKey][tempIndex].error = true;
            
            // Find and update the message in the DOM
            const msgEl = document.querySelector(`.message[data-id="${error.tempId}"]`);
            if (msgEl) {
              msgEl.classList.add('error-message');
              const pendingIndicator = msgEl.querySelector('.pending-indicator');
              if (pendingIndicator) {
                pendingIndicator.textContent = 'Failed';
                pendingIndicator.classList.remove('pending-indicator');
                pendingIndicator.classList.add('error-indicator');
              }
            }
          }
        }
      }
    });
    
    // Handle friend request accepted
    socket.on('friendRequestAccepted', (data) => {
      const { by, timestamp } = data;
      
      // Add user to chat list if not already there
      if (!addedUsers.has(by)) {
        addedUsers.add(by);
        
        // Add to online users if not already there
        if (!onlineUsers.has(by)) {
          onlineUsers.set(by, {
            username: by,
            isCurrentUser: false,
            isOnline: true
          });
        }
        
        updateUsersList();
      }
    });
    
    // Listen for user joined events
    socket.on('userJoined', (username) => {
      if (!onlineUsers.has(username)) {
        onlineUsers.set(username, {
          username: username,
          isCurrentUser: false
        });
        updateUsersList();
      }
    });
    
    // Listen for user left events
    socket.on('userLeft', (username) => {
      if (onlineUsers.has(username)) {
        onlineUsers.delete(username);
        updateUsersList();
      }
    });
    
    // Add a button to return to global chat
    const createGlobalChatButton = () => {
      const globalChatBtn = document.createElement('div');
      globalChatBtn.classList.add('global-chat-btn');
      globalChatBtn.innerHTML = `
        <i class="fas fa-globe"></i> Global Chat
      `;
      
      globalChatBtn.addEventListener('click', switchToGlobalChat);
      
      // Add it to the sidebar
      const sidebarHeader = document.querySelector('.sidebar-header');
      sidebarHeader.after(globalChatBtn);
    };
    
    createGlobalChatButton();
    
    // Friend request handling
    let pendingRequests = [];

    // Render pending friend requests in the sidebar
    const renderPendingRequests = () => {
      pendingRequestsContainer.innerHTML = '';
      if (pendingRequests.length === 0) return;
      const title = document.createElement('div');
      title.className = 'pending-title';
      title.textContent = 'Pending Requests';
      pendingRequestsContainer.appendChild(title);
      pendingRequests.forEach(req => {
        const reqDiv = document.createElement('div');
        reqDiv.className = 'pending-request-item';
        reqDiv.innerHTML = `
          <span class="pending-username">${req.from}</span>
          <button class="accept-request-btn" data-username="${req.from}">Accept</button>
          <button class="reject-request-btn" data-username="${req.from}">Reject</button>
        `;
        pendingRequestsContainer.appendChild(reqDiv);
      });
      // Add event listeners
      pendingRequestsContainer.querySelectorAll('.accept-request-btn').forEach(btn => {
        btn.onclick = () => acceptFriendRequest(btn.getAttribute('data-username'));
      });
      pendingRequestsContainer.querySelectorAll('.reject-request-btn').forEach(btn => {
        btn.onclick = () => rejectFriendRequest(btn.getAttribute('data-username'));
      });
    };

    // Listen for friend requests
    socket.on('friendRequest', (data) => {
      const { from, timestamp } = data;
      // Avoid duplicates
      if (!pendingRequests.some(r => r.from === from)) {
        pendingRequests.push({ from, timestamp });
        renderPendingRequests();
      }
      // Optionally, also show a system message
      const requestMessage = {
        username: 'System',
        text: `${from} sent you a friend request.`,
        timestamp: new Date(timestamp)
      };
      chatMessages.global.push(requestMessage);
      if (activeChat.type === 'global') displayMessage(requestMessage);
    });

    // Accept friend request
    const acceptFriendRequest = (username) => {
      socket.emit('acceptFriendRequest', { username });
      // Remove from pending
      pendingRequests = pendingRequests.filter(r => r.from !== username);
      renderPendingRequests();
      // Add user to chat list if not already there
      if (!addedUsers.has(username)) {
        addedUsers.add(username);
        if (!onlineUsers.has(username)) {
          onlineUsers.set(username, {
            username: username,
            isCurrentUser: false,
            isOnline: false
          });
        }
        updateUsersList();
      }
    };

    // Reject friend request
    const rejectFriendRequest = (username) => {
      socket.emit('rejectFriendRequest', { username });
      // Remove from pending
      pendingRequests = pendingRequests.filter(r => r.from !== username);
      renderPendingRequests();
    };
    
    // Emoji button click handler
    emojiBtn.addEventListener('click', () => {
      const emojis = ['😊', '😃', '😉', '😍', '🙂', '😎', '😢', '😂', '👍', '❤️'];
      
      // Create emoji picker
      const picker = document.createElement('div');
      picker.classList.add('emoji-picker');
      
      emojis.forEach(emoji => {
        const emojiEl = document.createElement('span');
        emojiEl.textContent = emoji;
        emojiEl.classList.add('emoji');
        emojiEl.addEventListener('click', () => {
          messageInput.value += emoji;
          document.body.removeChild(picker);
          messageInput.focus();
        });
        
        picker.appendChild(emojiEl);
      });
      
      // Position picker and add to body
      const rect = emojiBtn.getBoundingClientRect();
      picker.style.top = `${rect.bottom + 5}px`;
      picker.style.left = `${rect.left}px`;
      
      // Close picker when clicking outside
      const closePicker = (e) => {
        if (!picker.contains(e.target) && e.target !== emojiBtn) {
          document.body.removeChild(picker);
          document.removeEventListener('click', closePicker);
        }
      };
      
      // Add to DOM and set up event listener
      document.body.appendChild(picker);
      setTimeout(() => {
        document.addEventListener('click', closePicker);
      }, 100);
    });
  
    // Send private message
    const sendPrivateMessage = (text, recipient) => {
      if (!text.trim()) return;
      
      // Create a unique ID for this message to track it
      const tempId = 'msg_' + Date.now() + Math.random().toString(36).substr(2, 5);
      
      // Create message object
      const tempMessage = {
        username: user.username,
        text,
        timestamp: new Date(),
        isPrivate: true,
        isOwn: true,
        pending: true,
        recipient: recipient,
        tempId: tempId
      };
      
      // Add to chat messages
      const chatKey = `private_${recipient}`;
      if (!chatMessages[chatKey]) {
        chatMessages[chatKey] = [];
      }
      chatMessages[chatKey].push(tempMessage);
      
      // Display immediately
      displayMessage(tempMessage, tempId);
      
      // Send to server
      socket.emit('sendPrivateMessage', {
        text,
        recipient: recipient,
        tempId: tempId
      });
      
      // Clear input
      messageInput.value = '';
      messageInput.focus();
    };
  
    // Update the send message function to handle private messages
    const sendMessage = () => {
      const text = messageInput.value.trim();
      if (!text) return;
      
      if (activeChat.type === 'private') {
        sendPrivateMessage(text, activeChat.recipient);
      } else {
        // Global message
        const message = {
          text,
          timestamp: new Date()
        };
        socket.emit('sendMessage', message);
        messageInput.value = '';
        messageInput.focus();
      }
    };
  
    // Send message on button click
    sendBtn.addEventListener('click', sendMessage);
  
    // Send message on Enter key
    messageInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        sendMessage();
      }
    });
  
    // Handle logout
    logoutBtn.addEventListener('click', async () => {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
  
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/index.html';
      } catch (err) {
        console.error('Logout error:', err);
      }
    });
  
    // Search for users functionality
    const searchUsers = async (query) => {
      if (!query.trim()) {
        searchResults.innerHTML = '';
        searchResults.classList.remove('active');
        return;
      }
      
      try {
        const response = await fetch(`/api/auth/users/search?username=${query}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (!response.ok) {
          throw new Error('Failed to search users');
        }
        
        const users = await response.json();
        displaySearchResults(users);
      } catch (err) {
        console.error('Error searching users:', err);
        searchResults.innerHTML = `<div class="search-empty">Error searching users</div>`;
        searchResults.classList.add('active');
      }
    };
    
    // Display search results
    const displaySearchResults = (users) => {
      searchResults.innerHTML = '';
      
      if (users.length === 0) {
        searchResults.innerHTML = `<div class="search-empty">No users found</div>`;
        searchResults.classList.add('active');
        return;
      }
      
      users.forEach(foundUser => {
        // Don't show current user in results
        if (foundUser.username === user.username) {
          return;
        }
        
        const initials = foundUser.username.charAt(0).toUpperCase();
        const userEl = document.createElement('div');
        userEl.classList.add('search-result-item');
        
        userEl.innerHTML = `
          <div class="user-details">
            <div class="user-avatar">${initials}</div>
            <span>${foundUser.username}</span>
          </div>
          <button class="add-user-btn" data-username="${foundUser.username}" data-id="${foundUser._id}">
            <i class="fas fa-plus"></i>
          </button>
        `;
        
        searchResults.appendChild(userEl);
      });
      
      // If after filtering there are no results
      if (searchResults.children.length === 0) {
        searchResults.innerHTML = `<div class="search-empty">No new users found</div>`;
      }
      
      searchResults.classList.add('active');
      
      // Add event listeners to add buttons
      const addButtons = searchResults.querySelectorAll('.add-user-btn');
      addButtons.forEach(button => {
        button.addEventListener('click', (e) => {
          e.stopPropagation();
          const username = button.getAttribute('data-username');
          const userId = button.getAttribute('data-id');
          addUserToChat(username, userId);
        });
      });
    };
    
    // Add user to chat
    const addUserToChat = (username, userId) => {
      // Send friend request instead of immediately adding
      socket.emit('sendFriendRequest', { username });
      
      // Clear search
      userSearchInput.value = '';
      searchResults.innerHTML = '';
      searchResults.classList.remove('active');
      
      // Display system message
      displayMessage({
        username: 'System',
        text: `Friend request sent to ${username}`,
        timestamp: new Date()
      });
    };
    
    // Event listeners for search
    searchBtn.addEventListener('click', () => {
      searchUsers(userSearchInput.value);
    });
    
    userSearchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        searchUsers(userSearchInput.value);
      }
    });
    
    // Auto search after typing stops (debounced)
    let searchTimeout;
    userSearchInput.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        if (userSearchInput.value.length >= 2) {
          searchUsers(userSearchInput.value);
        } else {
          searchResults.innerHTML = '';
          searchResults.classList.remove('active');
        }
      }, 300);
    });
    
    // Hide search results when clicking outside
    document.addEventListener('click', (e) => {
      if (!searchResults.contains(e.target) && e.target !== userSearchInput && e.target !== searchBtn) {
        searchResults.classList.remove('active');
      }
    });
  });
  