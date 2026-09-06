import React, { useState } from 'react';
import { JoinLink } from '../types';
import { Link2, CheckCircle2, User, Mail, Shield, Building } from 'lucide-react';
import confetti from 'canvas-confetti';

interface JoinModalProps {
  joinLink: JoinLink;
  onJoinSuccess: (userData: {
    fullName: string;
    preferredName: string;
    email: string;
    gender?: 'male' | 'female' | 'other';
  }) => void;
  onClose: () => void;
}

export const JoinModal: React.FC<JoinModalProps> = ({
  joinLink,
  onJoinSuccess,
  onClose
}) => {
  const [fullName, setFullName] = useState('');
  const [preferredName, setPreferredName] = useState('');
  const [email, setEmail] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | 'other'>('female');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim()) return;

    confetti({ particleCount: 50, spread: 70 });
    onJoinSuccess({
      fullName,
      preferredName: preferredName || fullName,
      email,
      gender
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-stone-200">
        <div className="text-center pb-4 border-b border-stone-200 mb-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 text-[#2F3B7A] flex items-center justify-center mx-auto mb-2">
            <Link2 className="w-6 h-6" />
          </div>
          <h3 className="text-xl font-bold text-stone-900 font-serif-heading">
            You've Been Invited to Join
          </h3>
          <p className="text-xs text-stone-500 mt-1">
            Accept assignment as <strong className="text-[#2F3B7A] font-mono-code">@{joinLink.roleTitle}</strong> in {joinLink.deptName}.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-medium text-stone-700 mb-1">Full Legal Name:</label>
            <input
              type="text"
              required
              placeholder="e.g. Elena Rostova"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg bg-stone-50 focus:bg-white"
            />
          </div>

          <div>
            <label className="block font-medium text-stone-700 mb-1">Preferred Name / Call Name (Optional):</label>
            <input
              type="text"
              placeholder="e.g. Elena"
              value={preferredName}
              onChange={e => setPreferredName(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg bg-stone-50 focus:bg-white"
            />
          </div>

          <div>
            <label className="block font-medium text-stone-700 mb-1">Google Email / Account:</label>
            <input
              type="email"
              required
              placeholder="name@oakridge.edu"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg bg-stone-50 focus:bg-white"
            />
          </div>

          <div>
            <label className="block font-medium text-stone-700 mb-1">Gender (for administrative profile):</label>
            <select
              value={gender}
              onChange={e => setGender(e.target.value as any)}
              className="w-full px-3 py-2 border border-stone-300 rounded-lg bg-stone-50"
            >
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other / Prefer not to say</option>
            </select>
          </div>

          <div className="bg-[#FAF9F6] p-3 rounded-lg border border-stone-200 text-stone-600 text-[11px] flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              Joining automatically establishes your role boundaries and populates your task feed.
            </span>
          </div>

          <div className="flex gap-2 pt-3 border-t border-stone-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-stone-600 hover:bg-stone-100 rounded-lg font-medium text-xs"
            >
              Dismiss
            </button>
            <button
              type="submit"
              className="flex-1 py-2 bg-[#2F3B7A] hover:bg-[#232c5c] text-white rounded-lg font-semibold text-xs shadow-xs"
            >
              Accept & Enter Role
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
