// Test script to create a room and keep it alive for testing
const { io } = require('socket.io-client');

const socket = io('http://localhost:3000', {
  path: '/api/socket/io',
  transports: ['websocket', 'polling'],
});

socket.on('connect', () => {
  console.log('🟢 Connected to server:', socket.id);

  // Test room creation
  console.log('🧪 Creating test room...');
  socket.emit('create-room', {
    hostName: 'Test Host',
  });
});

socket.on('room-created', data => {
  console.log('✅ Room created successfully!');
  console.log(`🚪 Room ID: ${data.roomId}`);
  console.log(`🎫 Host Token: ${data.hostToken}`);
  console.log(`🌐 Visit: http://localhost:3000/room/${data.roomId}`);
  console.log('Keeping room alive... Press Ctrl+C to stop');
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
