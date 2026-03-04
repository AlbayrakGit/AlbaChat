/**
 * Yazıyor... göstergesi
 * Client → server: user:typing { groupId, isTyping }
 * Server → clients (odadaki diğerleri): user:typing { groupId, userId, username, isTyping }
 */
export function setupTypingHandler(io, socket) {
  const user = socket.data.user;

  socket.on('user:typing', ({ groupId, isTyping }) => {
    if (!groupId) return;

    // Göndereni hariç tüm oda üyelerine yayınla
    socket.to(`group:${groupId}`).emit('user:typing', {
      groupId,
      userId: user.id,
      username: user.username,
      displayName: user.display_name || user.username,
      isTyping: Boolean(isTyping),
    });
  });
}
