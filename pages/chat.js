import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';

import { decryptMessage, encryptMessage } from '../utils/crypto';
import { clearImportedKeys, takeImportedKeys } from '../utils/keyStore';

/** The recipient is free text, so history loading waits for typing to settle. */
const HISTORY_DEBOUNCE_MS = 500;

const DECRYPTION_FAILED = '⚠️ Decryption failed';
const NO_SENDER_COPY = '(Sent before sender copies were stored)';

function newLocalId() {
  return globalThis.crypto?.randomUUID
    ? globalThis.crypto.randomUUID()
    : `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Bring server and socket payloads into one shape with a stable id. */
function normalise(raw) {
  return {
    id: raw._id ?? raw.id ?? newLocalId(),
    sender: raw.sender,
    receiver: raw.receiver,
    content: raw.content,
    timestamp: raw.timestamp ? new Date(raw.timestamp) : new Date(),
  };
}

export default function Chat() {
  const router = useRouter();

  const [currentUser, setCurrentUser] = useState('');
  const [myPublicKey, setMyPublicKey] = useState('');
  const [privateKey, setPrivateKey] = useState('');
  const [isKeyLoaded, setIsKeyLoaded] = useState(false);
  const [keyError, setKeyError] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  const [recipient, setRecipient] = useState('');
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState([]);
  const [plaintexts, setPlaintexts] = useState({});
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [error, setError] = useState('');

  const socketRef = useRef(null);
  const recipientRef = useRef('');
  const decryptingRef = useRef(new Set());
  const messagesEndRef = useRef(null);

  useEffect(() => {
    recipientRef.current = recipient;
  }, [recipient]);

  // --- 0. IMPORTED KEYS ---
  // Picks up a keypair staged on the login page and pre-fills the field below.
  // Ownership is still proved by the verification step; this only saves a
  // second paste. Nothing happens if no keys were imported.
  useEffect(() => {
    const imported = takeImportedKeys();
    if (imported?.privateKey) setPrivateKey(imported.privateKey);
  }, []);

  // --- 1. IDENTITY ---
  // Resolved by the server from the signed session cookie. The client cannot
  // check a token's signature itself, so it must not decode one.
  useEffect(() => {
    let cancelled = false;

    fetch('/api/auth/me')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('Unauthorized'))))
      .then((data) => {
        if (!cancelled) setCurrentUser(data.username);
      })
      .catch(() => {
        if (!cancelled) router.replace('/');
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  // --- 2. REALTIME CONNECTION ---
  useEffect(() => {
    if (!currentUser) return undefined;

    let cancelled = false;

    const connect = async () => {
      try {
        await fetch('/api/socket');
      } catch {
        if (!cancelled) setError('Could not start the realtime connection.');
        return;
      }
      if (cancelled) return;

      // The session cookie travels with the handshake automatically; the server
      // derives the identity from it.
      const socket = io();
      socketRef.current = socket;

      socket.on('connect_error', (err) => {
        setError(`Realtime connection failed: ${err.message}`);
      });

      socket.on('receive_message', (data) => {
        // Messages for other conversations are already persisted and will load
        // when that conversation is opened; inserting them here would show them
        // in the wrong thread.
        if (data.sender !== recipientRef.current) return;
        setMessages((prev) => [...prev, normalise(data)]);
      });
    };

    connect();

    return () => {
      cancelled = true;
      const socket = socketRef.current;
      if (socket) {
        socket.off();
        socket.disconnect();
        socketRef.current = null;
      }
    };
  }, [currentUser]);

  // --- 3. CHAT HISTORY ---
  useEffect(() => {
    if (!recipient || !currentUser || !isKeyLoaded) return undefined;

    const timeoutId = setTimeout(async () => {
      setIsLoadingHistory(true);
      setError('');
      try {
        const res = await fetch(`/api/messages?peer=${encodeURIComponent(recipient)}`);
        if (!res.ok) throw new Error('Failed to load chat history');
        const history = await res.json();
        setMessages(history.map(normalise));
        setPlaintexts({});
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoadingHistory(false);
      }
    }, HISTORY_DEBOUNCE_MS);

    return () => clearTimeout(timeoutId);
  }, [recipient, currentUser, isKeyLoaded]);

  // --- 4. DECRYPTION ---
  // Each message is decrypted exactly once and the result cached by id, rather
  // than re-deriving the whole thread on every render.
  useEffect(() => {
    if (!isKeyLoaded || !privateKey) return undefined;

    const pending = messages.filter(
      (msg) => plaintexts[msg.id] === undefined && !decryptingRef.current.has(msg.id)
    );
    if (pending.length === 0) return undefined;

    pending.forEach((msg) => decryptingRef.current.add(msg.id));
    let cancelled = false;

    (async () => {
      try {
        const resolved = await Promise.all(
          pending.map(async (msg) => {
            // Own messages are read from the copy encapsulated to our own key.
            const envelope = msg.sender === currentUser ? msg.content?.senderCopy : msg.content;
            if (!envelope) return [msg.id, NO_SENDER_COPY];
            try {
              return [msg.id, await decryptMessage(envelope, privateKey)];
            } catch {
              return [msg.id, DECRYPTION_FAILED];
            }
          })
        );
        if (!cancelled) {
          setPlaintexts((prev) => ({ ...prev, ...Object.fromEntries(resolved) }));
        }
      } finally {
        pending.forEach((msg) => decryptingRef.current.delete(msg.id));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [messages, plaintexts, isKeyLoaded, privateKey, currentUser]);

  // --- 5. AUTO SCROLL ---
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, plaintexts]);

  // --- 6. SEND ---
  const handleSendMessage = async (e) => {
    e.preventDefault();
    setError('');

    const text = message.trim();
    if (!text || !recipient) return;

    const socket = socketRef.current;
    if (!socket?.connected) {
      setError('Not connected yet. Please wait a moment and try again.');
      return;
    }

    try {
      const res = await fetch(`/api/user/${encodeURIComponent(recipient)}`);
      if (!res.ok) {
        throw new Error(res.status === 404 ? 'User not found' : 'Could not fetch recipient key');
      }
      const { pqcPublicKey } = await res.json();

      // Encapsulated to the recipient and, separately, to ourselves so this
      // message stays readable in our own history.
      const content = await encryptMessage(pqcPublicKey, myPublicKey, text);
      const localId = newLocalId();

      // The sender is taken from the session on the server, not sent here.
      socket.emit('send_message', { receiver: recipient, content, timestamp: new Date() }, (ack) => {
        if (ack && ack.ok === false) {
          setError(ack.error || 'Message could not be delivered');
          setMessages((prev) => prev.filter((msg) => msg.id !== localId));
        }
      });

      setMessages((prev) => [
        ...prev,
        { id: localId, sender: currentUser, receiver: recipient, content, timestamp: new Date() },
      ]);
      setPlaintexts((prev) => ({ ...prev, [localId]: text }));
      setMessage('');
    } catch (err) {
      setError(err.message);
    }
  };

  // --- 7. KEY OWNERSHIP CHECK ---
  const verifyAndLoadKey = async () => {
    const candidate = privateKey.trim();
    if (!candidate) {
      setKeyError('Please paste your private key.');
      return;
    }

    setKeyError('');
    setIsVerifying(true);
    try {
      const res = await fetch(`/api/user/${encodeURIComponent(currentUser)}`);
      if (!res.ok) throw new Error('Could not fetch your account details.');

      const { pqcPublicKey } = await res.json();
      if (!pqcPublicKey) throw new Error('No public key is registered for your account.');

      // Encapsulate a nonce to our stored public key and confirm the pasted
      // private key opens it. A wrong key yields a different shared secret, so
      // the AES-GCM tag is what rejects it.
      const challenge = `VERIFY_ME_${Date.now()}`;
      const sealed = await encryptMessage(pqcPublicKey, null, challenge);
      const opened = await decryptMessage(sealed, candidate);

      if (opened !== challenge) throw new Error('That private key does not match your account.');

      setMyPublicKey(pqcPublicKey);
      setPrivateKey(candidate);
      setIsKeyLoaded(true);
    } catch (err) {
      setKeyError(err.message || 'Invalid key.');
    } finally {
      setIsVerifying(false);
    }
  };

  // --- 8. LOGOUT ---
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Clear local state regardless so the key does not linger in memory.
    }
    socketRef.current?.disconnect();
    socketRef.current = null;
    clearImportedKeys();
    setPrivateKey('');
    setIsKeyLoaded(false);
    router.push('/');
  };

  // --- 9. RENDER ---
  if (!isKeyLoaded) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-white p-4">
        <h1 className="text-2xl font-bold mb-4">Post-Quantum Verification</h1>
        <p className="mb-4 text-gray-400 text-sm text-center max-w-md">
          Security Check: Please prove you own the private key for <br />
          <span className="text-green-400 font-mono text-lg">{currentUser || '...'}</span>
        </p>

        <textarea
          className="w-full max-w-lg p-3 bg-gray-800 border border-green-500 rounded h-40 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-green-600"
          placeholder="Paste your Private Key (Hex) here..."
          value={privateKey}
          onChange={(e) => setPrivateKey(e.target.value)}
        />

        {keyError && <p className="mt-3 text-red-400 text-sm max-w-lg text-center">{keyError}</p>}

        <button
          onClick={verifyAndLoadKey}
          disabled={isVerifying || !currentUser}
          className="mt-6 bg-green-600 px-8 py-3 rounded font-bold hover:bg-green-700 transition duration-200 disabled:bg-gray-600"
        >
          {isVerifying ? 'Verifying...' : 'Verify & Load Identity'}
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-100">
      <header className="bg-blue-700 p-4 text-white flex justify-between items-center shadow-md">
        <h1 className="font-bold">Chat: {currentUser}</h1>
        <button
          onClick={handleLogout}
          className="bg-red-500 px-3 py-1 rounded hover:bg-red-600 text-sm"
        >
          Logout
        </button>
      </header>

      {error && (
        <div className="bg-red-100 border-b border-red-300 text-red-700 text-sm px-4 py-2">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoadingHistory && (
          <div className="text-center text-gray-500 text-xs mt-2">Loading chat history...</div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.sender === currentUser ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs md:max-w-md p-3 rounded-lg shadow-sm ${
                msg.sender === currentUser
                  ? 'bg-blue-600 text-white rounded-br-none'
                  : 'bg-white text-gray-800 border border-gray-200 rounded-bl-none'
              }`}
            >
              <p className="text-xs font-bold opacity-75 mb-1">{msg.sender}</p>
              <p className="text-sm break-words">
                {plaintexts[msg.id] ?? '🔒 Decrypting...'}
              </p>
              <span className="text-[10px] opacity-50 block text-right mt-1">
                {new Date(msg.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
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
        <button
          type="submit"
          className="bg-blue-600 text-white px-6 py-3 rounded font-bold hover:bg-blue-700 transition"
        >
          Send
        </button>
      </form>
    </div>
  );
}
