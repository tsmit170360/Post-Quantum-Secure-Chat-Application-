// import { Server } from 'socket.io';
// import dbConnect from '../../lib/dbConnect';
// import Message from '../../models/Message';

// export default async function SocketHandler(req, res) {
//   if (res.socket.server.io) {
//     res.end();
//     return;
//   }

//   console.log('Starting Socket.io Server...');
//   await dbConnect(); // Ensure DB connection

//   const io = new Server(res.socket.server);
//   res.socket.server.io = io;

//   io.on('connection', (socket) => {
//     const username = socket.handshake.query.username;
    
//     if (username) {
//         socket.join(username);
//         console.log(`✅ Server: ${username} connected`);
//     }

//     socket.on('send_message', async (data) => {
//       const { receiver, sender, content, timestamp } = data;
//       console.log(`📨 Routing message from ${sender} to ${receiver}`);
      
//       try {
//         // --- FIX IS HERE ---
//         // We save 'content' (the object), NOT 'text'
//         await Message.create({
//           sender,
//           receiver,
//           content, // <--- Correct field name matches models/Message.js
//           timestamp: timestamp || new Date()
//         });
        
//         console.log(`💾 Message saved to DB`);
        
//         // Deliver to receiver
//         io.to(receiver).emit('receive_message', {
//           sender,
//           content,
//           timestamp,
//           isEncrypted: true
//         });
        
//       } catch (error) {
//         console.error('❌ Error saving message:', error);
//       }
//     });

//     socket.on('disconnect', () => {
//       console.log(`❌ Server: ${username} disconnected`);
//     });
//   });

//   res.end();
// }

// --
import { Server } from 'socket.io';
import dbConnect from '../../lib/dbConnect';
import Message from '../../models/Message';

export default async function SocketHandler(req, res) {
  // If server is already running, don't start it again
  if (res.socket.server.io) {
    res.end();
    return;
  }

  console.log('Starting Socket.io Server...');
  
  // Connect to database once when server starts
  await dbConnect();
  
  const io = new Server(res.socket.server);
  res.socket.server.io = io;

  io.on('connection', (socket) => {
    // 1. GET USERNAME FROM CONNECTION
    const username = socket.handshake.query.username;
    
    if (username) {
        socket.join(username); // Put user in their own room
        console.log(`✅ Server: ${username} connected (ID: ${socket.id})`);
    }

    // 2. LISTEN FOR MESSAGES
    socket.on('send_message', async (data) => {
      const { receiver, sender, content, timestamp } = data;
      console.log(`📨 Server: Routing message from ${sender} to ${receiver}`);
      
      try {
        // Save message to database
        // FIX: We save 'content' directly because your Schema now uses 'content', not 'text'
        await Message.create({
          sender,
          receiver,
          content, // Save the encrypted object { kemCiphertext, aesIv, encryptedMessage }
          timestamp: timestamp || new Date()
        });
        
        console.log(`💾 Server: Message saved to database`);
        
        // Send to receiver's room
        io.to(receiver).emit('receive_message', {
          sender,
          content,
          timestamp,
          isEncrypted: true
        });
        
      } catch (error) {
        console.error('Error saving message:', error);
        // Still try to deliver the message even if DB save fails
        io.to(receiver).emit('receive_message', {
          sender,
          content,
          timestamp,
          isEncrypted: true
        });
      }
    });

    socket.on('disconnect', () => {
      console.log(`❌ Server: ${username} disconnected`);
    });
  });

  res.end();
}