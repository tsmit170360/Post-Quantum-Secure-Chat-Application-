import { Server } from 'socket.io';

import { userFromCookieHeader } from '../../lib/auth';
import dbConnect from '../../lib/dbConnect';
import Message from '../../models/Message';

/**
 * Boots the Socket.IO server and attaches it to the underlying Node HTTP
 * server. Requires a long-lived Node process; it will not work on a serverless
 * host, and a horizontally scaled deployment would need a shared adapter for
 * `io.to(room)` to reach users on other instances.
 */
export default async function SocketHandler(req, res) {
  const httpServer = res.socket.server;

  // Guard against two concurrent requests both constructing a server during a
  // cold start: the promise is cached synchronously before the first await.
  if (httpServer.io) {
    res.end();
    return;
  }
  if (!httpServer.ioBootstrap) {
    httpServer.ioBootstrap = bootstrap(httpServer);
  }

  try {
    await httpServer.ioBootstrap;
  } catch (error) {
    httpServer.ioBootstrap = null;
    console.error('Socket.IO bootstrap failed:', error);
    res.status(500).end();
    return;
  }

  res.end();
}

async function bootstrap(httpServer) {
  await dbConnect();

  const io = new Server(httpServer);

  // Identity comes from the signed session cookie, never from a handshake
  // parameter. Previously the username was self-asserted, which let anyone
  // join another user's delivery room and send messages under their name.
  io.use((socket, next) => {
    const user = userFromCookieHeader(socket.handshake.headers?.cookie);
    if (!user) return next(new Error('Unauthorized'));
    socket.data.user = user;
    return next();
  });

  io.on('connection', (socket) => {
    const username = socket.data.user.username;
    socket.join(username);
    console.log(`Socket connected: ${username} (${socket.id})`);

    socket.on('send_message', async (data, ack) => {
      const { receiver, content, timestamp } = data ?? {};

      if (typeof receiver !== 'string' || !receiver) {
        ack?.({ ok: false, error: 'A receiver is required' });
        return;
      }
      if (!content?.kemCiphertext || !content?.aesIv || !content?.encryptedMessage) {
        ack?.({ ok: false, error: 'A complete encrypted payload is required' });
        return;
      }

      const message = {
        sender: username, // from the verified token
        receiver,
        content,
        timestamp: timestamp || new Date(),
      };

      try {
        const saved = await Message.create(message);

        // Only deliver once the message is durable. Delivering after a failed
        // write made both parties believe a lost message had been sent.
        io.to(receiver).emit('receive_message', {
          _id: saved._id.toString(),
          sender: message.sender,
          receiver: message.receiver,
          content: message.content,
          timestamp: message.timestamp,
        });

        ack?.({ ok: true, id: saved._id.toString() });
      } catch (error) {
        console.error('Error saving message:', error);
        ack?.({ ok: false, error: 'Message could not be saved' });
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${username}`);
    });
  });

  httpServer.io = io;
  return io;
}
