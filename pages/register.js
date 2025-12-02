import { useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';

export default function Register() {
  const [form, setForm] = useState({ username: '', password: '', pqcPublicKey: '' });
  const router = useRouter();

  const handleRegister = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    
    if (res.ok) {
        alert("Registration Successful! Please Login.");
        router.push('/');
    } else {
        alert('Error registering. Ensure username is unique and all fields are filled.');
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <form onSubmit={handleRegister} className="bg-white p-6 rounded shadow-md w-full max-w-lg">
        <h1 className="text-2xl font-bold mb-4 text-center">Post-Quantum Registration</h1>
        
        <label className="block mb-2 font-bold">Username</label>
        <input
          className="w-full p-2 border mb-4 rounded"
          placeholder="Enter username"
          value={form.username}
          onChange={(e) => setForm({...form, username: e.target.value})}
        />
        
        <label className="block mb-2 font-bold">Password</label>
        <input
          className="w-full p-2 border mb-4 rounded"
          type="password"
          placeholder="Enter password"
          value={form.password}
          onChange={(e) => setForm({...form, password: e.target.value})}
        />
        
        <label className="block mb-2 font-bold text-blue-800">Kyber-512 Public Key</label>
        <p className="text-xs text-gray-500 mb-1">Paste the output from your C program here.</p>
        <textarea
          className="w-full p-2 border mb-6 text-xs font-mono bg-gray-50 h-32 rounded"
          placeholder="Paste PUBLIC_KEY hex string here..."
          value={form.pqcPublicKey}
          onChange={(e) => setForm({...form, pqcPublicKey: e.target.value})}
        />

        <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white p-3 rounded font-bold">
          Register User
        </button>
        
        <div className="mt-4 text-center">
            <Link href="/" className="text-blue-500 hover:underline">Already have an account? Login</Link>
        </div>
      </form>
    </div>
  );
}