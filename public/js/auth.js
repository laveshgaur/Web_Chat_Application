document.addEventListener('DOMContentLoaded', () => {
    const loginTab = document.getElementById('login-tab');
    const registerTab = document.getElementById('register-tab');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    const loginError = document.getElementById('login-error');
    const registerError = document.getElementById('register-error');
  
    // Show the login form initially to trigger animation
    setTimeout(() => {
      loginForm.style.opacity = '1';
    }, 100);
  
    // Check if user is already logged in
    fetch('/api/auth/user')
      .then(response => {
        if (response.ok) {
          window.location.href = '/chat.html';
        }
      })
      .catch(err => console.error('Error checking authentication:', err));
  
    // Switch between login and register forms with animation
    loginTab.addEventListener('click', () => {
      loginTab.classList.add('active');
      registerTab.classList.remove('active');
      
      // Animate form transition
      registerForm.style.opacity = '0';
      setTimeout(() => {
        registerForm.classList.add('hidden');
        loginForm.classList.remove('hidden');
        setTimeout(() => {
          loginForm.style.opacity = '1';
        }, 50);
      }, 300);
    });
  
    registerTab.addEventListener('click', () => {
      registerTab.classList.add('active');
      loginTab.classList.remove('active');
      
      // Animate form transition
      loginForm.style.opacity = '0';
      setTimeout(() => {
        loginForm.classList.add('hidden');
        registerForm.classList.remove('hidden');
        setTimeout(() => {
          registerForm.style.opacity = '1';
        }, 50);
      }, 300);
    });
  
    // Handle login
    loginBtn.addEventListener('click', async () => {
      const email = document.getElementById('login-email').value;
      const password = document.getElementById('login-password').value;
  
      if (!email || !password) {
        loginError.textContent = 'Please fill in all fields';
        return;
      }
  
      try {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ email, password })
        });
  
        const data = await response.json();
  
        if (!response.ok) {
          loginError.textContent = data.message || 'Login failed';
          return;
        }
  
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        window.location.href = '/chat.html';
      } catch (err) {
        console.error('Login error:', err);
        loginError.textContent = 'Server error, please try again';
      }
    });
  
    // Handle registration
    registerBtn.addEventListener('click', async () => {
      const username = document.getElementById('register-username').value;
      const email = document.getElementById('register-email').value;
      const password = document.getElementById('register-password').value;
      const confirmPassword = document.getElementById('register-confirm-password').value;
  
      if (!username || !email || !password || !confirmPassword) {
        registerError.textContent = 'Please fill in all fields';
        return;
      }
  
      if (password !== confirmPassword) {
        registerError.textContent = 'Passwords do not match';
        return;
      }
  
      try {
        const response = await fetch('/api/auth/register', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ username, email, password })
        });
  
        const data = await response.json();
  
        if (!response.ok) {
          registerError.textContent = data.message || 'Registration failed';
          return;
        }
  
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        window.location.href = '/chat.html';
      } catch (err) {
        console.error('Registration error:', err);
        registerError.textContent = 'Server error, please try again';
      }
    });
  });