import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/router';
import io from 'socket.io-client';
import Cookies from 'js-cookie';
import { encryptMessage, decryptMessage } from '../utils/crypto';

let socket;

export default function Chat() {
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [privateKey, setPrivateKey] = useState(''); 
  const [isKeyLoaded, setIsKeyLoaded] = useState(false);
  const [recipient, setRecipient] = useState(''); 
  const [currentUser, setCurrentUser] = useState('');
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  
  const router = useRouter();
  const messagesEndRef = useRef(null);

  // --- 1. CONNECT TO SERVER ---
  useEffect(() => {
    const token = Cookies.get('token');
    if (!token) {
        router.push('/');
        return;
    }

    // A. Decode Username
    let userFromToken = '';
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => 
            '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
        ).join(''));
        userFromToken = JSON.parse(jsonPayload).username;
        setCurrentUser(userFromToken);
    } catch (e) {
        console.error("Token error", e);
        return;
    }

    // B. Initialize Socket
    const initSocket = async () => {
      await fetch('/api/socket'); 
      
      socket = io({
          query: { username: userFromToken } 
      });

      socket.on('connect', () => {
          console.log(`✅ CLIENT: Connected as ${userFromToken}`);
      });

      socket.on('receive_message', (data) => {
          console.log("📩 CLIENT: Message received!", data); 
          setMessages((prev) => [...prev, { ...data, isEncrypted: true }]);
      });
    };

    initSocket();

    return () => { if (socket) socket.disconnect(); };
  }, [router]);

  // --- 2. LOAD CHAT HISTORY WHEN RECIPIENT CHANGES ---
  useEffect(() => {
    if (!recipient || !currentUser || !isKeyLoaded) return;

    const loadChatHistory = async () => {
      setIsLoadingHistory(true);
      try {
        const res = await fetch(`/api/messages?user1=${currentUser}&user2=${recipient}`);
        
        if (!res.ok) {
          throw new Error('Failed to fetch chat history');
        }

        const history = await res.json();
        
        // Transform history to match our message format
        const formattedHistory = history.map(msg => ({
            sender: msg.sender,
            receiver: msg.receiver,
            // FIX: Use 'content' directly. Do NOT JSON.parse it because schema now stores it as an object.
            content: msg.content, 
            timestamp: new Date(msg.timestamp),
            // Mark as encrypted so the decryption effect picks it up
            isEncrypted: msg.sender !== currentUser 
        }));

        setMessages(formattedHistory);
      } catch (error) {
        console.error('Error loading chat history:', error);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    // Small debounce to prevent spamming while typing
    const timeoutId = setTimeout(() => {
        loadChatHistory();
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [recipient, currentUser, isKeyLoaded]);

  // --- 3. DECRYPT MESSAGES ---
  useEffect(() => {
    if (!isKeyLoaded || !privateKey) return;

    const decryptAll = async () => {
        const decryptedPromises = messages.map(async (msg) => {
            // Only decrypt if it is marked encrypted AND has content AND we haven't decrypted it yet
            if (msg.isEncrypted && msg.content && !msg.text) {
                // If I sent it, I can't decrypt it (I don't have Bob's key)
                if (msg.sender === currentUser) {
                    return { ...msg, text: "(Sent Encrypted)", isEncrypted: false };
                }

                try {
                    const decryptedText = await decryptMessage(msg.content, privateKey);
                    return { ...msg, text: decryptedText, isEncrypted: false };
                } catch (e) {
                    // console.error("Decryption failed", e);
                    return { ...msg, text: "⚠️ Decryption Failed", isEncrypted: false };
                }
            }
            return msg;
        });
        
        const results = await Promise.all(decryptedPromises);
        // Only update state if something actually changed to avoid infinite loops
        if (JSON.stringify(results) !== JSON.stringify(messages)) {
            setMessages(results);
        }
    };
    decryptAll();
  }, [messages, isKeyLoaded, privateKey, currentUser]);

  // --- 4. AUTO SCROLL ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- 5. SEND MESSAGE ---
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!message || !recipient) return;

    try {
        // Fetch Recipient's Public Key
        const res = await fetch(`/api/user/${recipient}`);
        if (!res.ok) throw new Error("User not found");
        const { pqcPublicKey } = await res.json();

        // Encrypt
        const payload = await encryptMessage(pqcPublicKey, message);

        // Send via Socket
        // FIX: Only emit via socket. The server handles saving to DB. 
        // Do NOT call fetch('/api/messages/save') here.
        socket.emit('send_message', {
            sender: currentUser,
            receiver: recipient,
            content: payload,
            timestamp: new Date()
        });

        // Show locally immediately
        setMessages((prev) => [...prev, { 
            sender: currentUser, 
            text: message, 
            timestamp: new Date(),
            isEncrypted: false 
        }]);
        
        setMessage('');
    } catch (error) {
        alert("Error: " + error.message);
    }
  };

  if (!isKeyLoaded) {
    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
            <h1 className="text-2xl font-bold mb-4">Post-Quantum Login</h1>
            <textarea
                className="w-full max-w-lg p-3 bg-gray-800 border border-green-500 rounded h-40 font-mono text-xs"
                placeholder="Paste PRIVATE KEY here..."
                value={privateKey}
                onChange={(e) => setPrivateKey(e.target.value)}
            />
            <button 
                onClick={() => setIsKeyLoaded(true)}
                className="mt-6 bg-green-600 px-8 py-3 rounded font-bold hover:bg-green-700"
            >
                Load Key
            </button>
        </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <header className="bg-blue-700 p-4 text-white flex justify-between items-center shadow-md">
        <h1 className="font-bold">Chat: {currentUser}</h1>
        <button onClick={() => window.location.reload()} className="bg-red-500 px-3 py-1 rounded hover:bg-red-600 text-sm">Logout</button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoadingHistory && (
          <div className="text-center text-gray-500 text-xs mt-2">Loading chat history...</div>
        )}
        
        {messages.map((msg, index) => (
          <div key={index} className={`flex ${msg.sender === currentUser ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-xs md:max-w-md p-3 rounded-lg shadow-sm ${msg.sender === currentUser ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'}`}>
              <p className="text-xs font-bold opacity-75 mb-1">{msg.sender}</p>
              <p className="text-sm break-words">{msg.text || (msg.isEncrypted ? "🔒 Decrypting..." : msg.text)}</p>
              <span className="text-[10px] opacity-50 block text-right mt-1">
                {new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
              </span>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="p-4 bg-white shadow-lg flex gap-2 border-t">
        <input 
          className="w-1/3 md:w-1/4 p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" 
          placeholder="Recipient" 
          value={recipient} 
          onChange={(e) => setRecipient(e.target.value)} 
        />
        <input 
          className="flex-1 p-3 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" 
          placeholder="Message" 
          value={message} 
          onChange={(e) => setMessage(e.target.value)} 
        />
        <button type="submit" className="bg-blue-600 text-white px-6 py-3 rounded font-bold hover:bg-blue-700 transition">Send</button>
      </form>
    </div>
  );
}