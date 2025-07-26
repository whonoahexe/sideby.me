// Simple test script to test room creation
const { io } = require('socket.io-client');

const socket = io('http://localhost:3000', {
  path: '/api/socket/io',
  transports: ['websocket', 'polling'],
});

socket.on('connect', () => {
  console.log('🟢 Connected to server:', socket.id);

  // Test room creation
  console.log('🧪 Testing room creation...');
  socket.emit('create-room', {
    hostName: 'Test User',
  });
});

socket.on('room-created', data => {
  console.log('✅ Room created successfully:', data);
  process.exit(0);
});

socket.on('room-error', data => {
  console.log('❌ Room creation failed:', data);
  process.exit(1);
});

socket.on('disconnect', () => {
  console.log('🔴 Disconnected from server');
});

socket.on('connect_error', error => {
  console.log('💥 Connection error:', error);
  process.exit(1);
});

// Timeout after 10 seconds
setTimeout(() => {
  console.log('⏰ Test timed out');
  process.exit(1);
}, 10000);
