import Link from 'next/link';
import { useRouter } from 'next/router';
import { useState } from 'react';

import { MIN_PASSWORD_LENGTH } from '../lib/validation';
import { PUBLIC_KEY_HEX_LENGTH } from '../utils/pqcParams';

export default function Register() {
  const [form, setForm] = useState({ username: '', password: '', pqcPublicKey: '' });
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, pqcPublicKey: form.pqcPublicKey.trim() }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || 'Registration failed. Please try again.');
        return;
      }

      router.push('/');
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <form onSubmit={handleRegister} className="bg-white p-6 rounded shadow-md w-full max-w-lg">
        <h1 className="text-2xl font-bold mb-4 text-center">Post-Quantum Registration</h1>

        {error && <p className="text-red-600 text-sm mb-4 text-center">{error}</p>}

        <label className="block mb-2 font-bold" htmlFor="username">
          Username
        </label>
        <input
          id="username"
          className="w-full p-2 border mb-1 rounded"
          placeholder="Enter username"
          autoComplete="username"
          value={form.username}
          onChange={update('username')}
        />
        <p className="text-xs text-gray-500 mb-4">
          3-30 characters: letters, numbers or underscores.
        </p>

        <label className="block mb-2 font-bold" htmlFor="password">
          Password
        </label>
        <input
          id="password"
          className="w-full p-2 border mb-1 rounded"
          type="password"
          placeholder="Enter password"
          autoComplete="new-password"
          value={form.password}
          onChange={update('password')}
        />
        <p className="text-xs text-gray-500 mb-4">
          At least {MIN_PASSWORD_LENGTH} characters.
        </p>

        <label className="block mb-2 font-bold text-blue-800" htmlFor="pqcPublicKey">
          Kyber-512 Public Key
        </label>
        <p className="text-xs text-gray-500 mb-1">
          Paste the output from the key generator ({PUBLIC_KEY_HEX_LENGTH} hex characters).
        </p>
        <textarea
          id="pqcPublicKey"
          className="w-full p-2 border mb-6 text-xs font-mono bg-gray-50 h-32 rounded"
          placeholder="Paste PUBLIC_KEY hex string here..."
          value={form.pqcPublicKey}
          onChange={update('pqcPublicKey')}
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded font-bold disabled:bg-gray-400"
        >
          {isSubmitting ? 'Registering...' : 'Register User'}
        </button>

        <div className="mt-4 text-center">
          <Link href="/" className="text-blue-500 hover:underline">
            Already have an account? Login
          </Link>
        </div>
      </form>
    </div>
  );
}
