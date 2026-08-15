import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';

import { isHexOfLength } from '../utils/hex';
import { setImportedKeys } from '../utils/keyStore';
import { PUBLIC_KEY_BYTES, SECRET_KEY_BYTES } from '../utils/pqcParams';

export default function Home() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const [manualPubKey, setManualPubKey] = useState('');
  const [manualPrivKey, setManualPrivKey] = useState('');
  const [importError, setImportError] = useState('');
  const [importMessage, setImportMessage] = useState('');

  const handleImportKeys = () => {
    setImportError('');
    setImportMessage('');

    const publicKey = manualPubKey.trim();
    const privateKey = manualPrivKey.trim();

    // Exact lengths, not just "looks like hex": these values are copied into
    // fixed-size WebAssembly allocations later on.
    if (!isHexOfLength(publicKey, PUBLIC_KEY_BYTES)) {
      setImportError(`Public key must be ${PUBLIC_KEY_BYTES * 2} hex characters.`);
      return;
    }
    if (!isHexOfLength(privateKey, SECRET_KEY_BYTES)) {
      setImportError(`Private key must be ${SECRET_KEY_BYTES * 2} hex characters.`);
      return;
    }

    setImportedKeys({ publicKey, privateKey });
    setImportMessage('Keys imported for this session. You can now log in.');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.message || 'Login failed');
        return;
      }

      // The session is set by the server as an HttpOnly cookie, so there is
      // nothing for the client to store.
      router.push('/chat');
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen bg-gray-100">
      <form onSubmit={handleLogin} className="p-8 bg-white rounded-lg shadow-md w-80">
        <h1 className="text-2xl font-bold mb-6 text-center text-gray-800">Login</h1>

        {error && <p className="text-red-500 text-center mb-4 text-sm">{error}</p>}

        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          autoComplete="username"
          className="w-full px-4 py-2 mb-4 border rounded-md text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          className="w-full px-4 py-2 mb-4 border rounded-md text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full px-4 py-2 font-semibold text-white bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none disabled:bg-gray-400"
        >
          {isSubmitting ? 'Logging in...' : 'Login'}
        </button>

        <p className="text-center mt-4 text-sm text-gray-600">
          No account?{' '}
          <Link href="/register" className="text-blue-500 hover:underline">
            Register here
          </Link>
        </p>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-bold text-gray-500 mb-3 uppercase tracking-wider">
            Developer Mode: Import Keys
          </h3>

          <textarea
            value={manualPubKey}
            onChange={(e) => setManualPubKey(e.target.value)}
            placeholder="Paste Public Key Hex (F2A1...)"
            className="w-full px-3 py-2 mb-2 text-xs font-mono border rounded bg-gray-50 focus:outline-none"
            rows="2"
          />

          <textarea
            value={manualPrivKey}
            onChange={(e) => setManualPrivKey(e.target.value)}
            placeholder="Paste Private Key Hex (25B3...)"
            className="w-full px-3 py-2 mb-2 text-xs font-mono border rounded bg-gray-50 focus:outline-none"
            rows="2"
          />

          {importError && <p className="text-red-500 text-xs mb-2">{importError}</p>}
          {importMessage && <p className="text-green-600 text-xs mb-2">{importMessage}</p>}

          <button
            type="button"
            onClick={handleImportKeys}
            className="w-full py-2 text-xs font-bold text-gray-600 bg-gray-200 rounded hover:bg-gray-300"
          >
            Load Terminal Keys
          </button>

          <p className="text-[10px] text-gray-400 mt-2">
            Held in memory for this session only; lost on refresh.
          </p>
        </div>
      </form>
    </div>
  );
}
