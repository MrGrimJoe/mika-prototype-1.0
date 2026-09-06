import React, { useState } from 'react';
import { Phone, MessageSquare, PhoneCall, Send, Check, Clock, UserCheck, X, Shield, Headphones } from 'lucide-react';

interface CallAssistanceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CallAssistanceModal: React.FC<CallAssistanceModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'call' | 'text'>('overview');
  
  // Call form state
  const [callName, setCallName] = useState('');
  const [callPhone, setCallPhone] = useState('');
  const [callOrgType, setCallOrgType] = useState('Company / Business');
  const [callSubmitted, setCallSubmitted] = useState(false);

  // Text form state
  const [textName, setTextName] = useState('');
  const [textContact, setTextContact] = useState('');
  const [textMessage, setTextMessage] = useState('');
  const [textSubmitted, setTextSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleCallSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!callPhone.trim()) return;
    setCallSubmitted(true);
  };

  const handleTextSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textMessage.trim() || !textContact.trim()) return;
    setTextSubmitted(true);
  };

  return (
    <div
      id="call-assistance-overlay"
      className="fixed inset-0 bg-neutral-950/45 backdrop-blur-[1px] flex items-center justify-center p-4 z-50 font-mono select-none"
      onClick={onClose}
    >
      <div
        id="call-assistance-dialog"
        className="w-full max-w-xl bg-white border-2 border-neutral-900 rounded-sm shadow-[6px_6px_0px_#18181b] text-neutral-900 flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-[#f2f7f4] border-b-2 border-neutral-900 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 bg-emerald-700 text-white rounded-xs flex items-center justify-center shadow-[1px_1px_0px_#064e3b]">
              <Headphones size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-sm sm:text-base tracking-tight text-neutral-900">
                  LIVE ASSISTANCE SERVICE
                </h2>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 border border-emerald-300 rounded-xs">
                  100% Free
                </span>
              </div>
              <p className="text-[11px] text-neutral-600">
                Have an employee construct your complete organizational flowchart on the spot
              </p>
            </div>
          </div>
          <button
            type="button"
            id="close-assistance-btn"
            onClick={onClose}
            className="text-neutral-400 hover:text-neutral-900 p-1 rounded-xs transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* What this option means banner */}
        <div className="bg-[#fcfbf7] border-b border-neutral-200 px-5 py-2.5 text-xs text-neutral-800 leading-relaxed space-y-1">
          <div className="font-bold text-neutral-950 flex items-center gap-1.5">
            <UserCheck size={14} className="text-emerald-700" />
            <span>What Does This Option Mean?</span>
          </div>
          <p className="text-[11px] text-neutral-700">
            You do not have to build your hierarchy from scratch. By using Call Assistance, you connect directly with an employee or specialist helper. Simply tell them what structure you need, and they will build and organize all departments, roots, section groupings, and roles for you for free on the spot.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-neutral-300 bg-neutral-100 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`flex-1 py-2 px-3 text-center font-semibold transition-colors border-r border-neutral-300 ${
              activeTab === 'overview'
                ? 'bg-white text-neutral-900 border-b-2 border-b-emerald-700'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60'
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('call')}
            className={`flex-1 py-2 px-3 text-center font-semibold transition-colors border-r border-neutral-300 flex items-center justify-center gap-1.5 ${
              activeTab === 'call'
                ? 'bg-white text-neutral-900 border-b-2 border-b-emerald-700'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60'
            }`}
          >
            <Phone size={13} className="text-emerald-700" />
            <span>Call an Employee</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('text')}
            className={`flex-1 py-2 px-3 text-center font-semibold transition-colors flex items-center justify-center gap-1.5 ${
              activeTab === 'text'
                ? 'bg-white text-neutral-900 border-b-2 border-b-emerald-700'
                : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-200/60'
            }`}
          >
            <MessageSquare size={13} className="text-emerald-700" />
            <span>Text a Helper</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto max-h-[55vh] text-xs space-y-4">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Call Card */}
                <div
                  onClick={() => setActiveTab('call')}
                  className="border border-neutral-300 bg-[#fbfbfa] hover:bg-[#f6fbf7] hover:border-emerald-600 p-3.5 rounded-xs cursor-pointer transition-all space-y-2 group shadow-[2px_2px_0px_#e5e5e5]"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-neutral-900 flex items-center gap-1.5">
                      <PhoneCall size={15} className="text-emerald-700" />
                      Speak via Phone
                    </span>
                    <span className="text-[10px] bg-neutral-200 group-hover:bg-emerald-100 text-neutral-700 group-hover:text-emerald-900 px-1.5 py-0.5 rounded-xs">
                      Live
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-600 leading-snug">
                    Call our live helper or request an immediate callback. Describe your setup, and we build it live.
                  </p>
                  <div className="text-[11px] font-bold text-emerald-800 flex items-center gap-1 pt-1">
                    <span>Connect by Phone</span>
                    <span>&rarr;</span>
                  </div>
                </div>

                {/* Text Card */}
                <div
                  onClick={() => setActiveTab('text')}
                  className="border border-neutral-300 bg-[#fbfbfa] hover:bg-[#f6fbf7] hover:border-emerald-600 p-3.5 rounded-xs cursor-pointer transition-all space-y-2 group shadow-[2px_2px_0px_#e5e5e5]"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-neutral-900 flex items-center gap-1.5">
                      <MessageSquare size={15} className="text-emerald-700" />
                      Text an Employee
                    </span>
                    <span className="text-[10px] bg-neutral-200 group-hover:bg-emerald-100 text-neutral-700 group-hover:text-emerald-900 px-1.5 py-0.5 rounded-xs">
                      Chat / SMS
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-600 leading-snug">
                    Send a quick text message or requirements note with your departments and roles. We will format it immediately.
                  </p>
                  <div className="text-[11px] font-bold text-emerald-800 flex items-center gap-1 pt-1">
                    <span>Send Text Message</span>
                    <span>&rarr;</span>
                  </div>
                </div>
              </div>

              {/* Steps overview */}
              <div className="border border-neutral-300 bg-[#fbfbfa] p-3.5 rounded-xs space-y-2">
                <span className="font-bold text-neutral-900 text-xs uppercase tracking-wide block">
                  How On-the-Spot Setup Works:
                </span>
                <ol className="space-y-1.5 text-[11px] text-neutral-700 list-decimal list-inside leading-relaxed">
                  <li>
                    <strong>Choose Call or Text:</strong> Request an immediate voice call or submit your hierarchy requirements via text.
                  </li>
                  <li>
                    <strong>Describe Your Structure:</strong> Tell the employee your primary department, branches, sections, and roles.
                  </li>
                  <li>
                    <strong>Live Construction:</strong> The employee crafts the complete organizational hierarchy for you free of charge.
                  </li>
                </ol>
              </div>

              <div className="flex items-center justify-between bg-neutral-100 border border-neutral-300 p-2.5 rounded-xs text-[11px] text-neutral-600">
                <span className="flex items-center gap-1">
                  <Clock size={13} className="text-neutral-500" />
                  Average Response Time: Under 60 seconds
                </span>
                <span className="text-emerald-800 font-semibold">Available Now</span>
              </div>
            </div>
          )}

          {activeTab === 'call' && (
            <div className="space-y-4">
              {callSubmitted ? (
                <div className="border border-emerald-500 bg-[#f0fdf4] p-4 rounded-xs text-center space-y-2">
                  <div className="w-10 h-10 bg-emerald-700 text-white rounded-full flex items-center justify-center mx-auto">
                    <Check size={20} />
                  </div>
                  <h3 className="font-bold text-sm text-neutral-900">Callback Request Confirmed</h3>
                  <p className="text-xs text-neutral-700 leading-relaxed max-w-md mx-auto">
                    An employee is dialing <strong>{callPhone}</strong> now to assist you in creating your organization on the spot. Please keep your phone nearby.
                  </p>
                  <button
                    type="button"
                    onClick={() => setCallSubmitted(false)}
                    className="mt-2 text-[11px] text-emerald-800 hover:underline font-semibold"
                  >
                    Submit another number
                  </button>
                </div>
              ) : (
                <>
                  {/* Direct Phone Number Option */}
                  <div className="border border-neutral-300 bg-[#fafaf8] p-3.5 rounded-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-neutral-900 flex items-center gap-1.5">
                        <Phone size={14} className="text-emerald-700" />
                        Direct Phone Line
                      </span>
                      <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-xs">
                        Toll-Free
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-600">
                      Dial directly to speak with an employee immediately:
                    </p>
                    <div className="flex items-center justify-between bg-white border border-neutral-400 p-2 rounded-xs">
                      <span className="font-bold text-sm text-neutral-900 tracking-wider">
                        +1 (800) 555-0199
                      </span>
                      <a
                        href="tel:+18005550199"
                        className="bg-emerald-700 hover:bg-emerald-800 text-white px-3 py-1 rounded-xs font-semibold text-xs transition-colors flex items-center gap-1"
                      >
                        <PhoneCall size={12} />
                        Call Now
                      </a>
                    </div>
                  </div>

                  {/* Request Callback Form */}
                  <form onSubmit={handleCallSubmit} className="border border-neutral-300 bg-[#fafaf8] p-3.5 rounded-xs space-y-3">
                    <div className="font-bold text-neutral-900 text-xs uppercase tracking-wide">
                      Or Request An Immediate Callback
                    </div>
                    <p className="text-[11px] text-neutral-600">
                      Enter your phone number and an employee will call you back within 60 seconds:
                    </p>

                    <div className="space-y-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-700 mb-0.5">
                          Your Name (Optional):
                        </label>
                        <input
                          type="text"
                          value={callName}
                          onChange={(e) => setCallName(e.target.value)}
                          placeholder="e.g. Alex Morgan"
                          className="w-full bg-white border border-neutral-300 focus:border-neutral-900 px-2.5 py-1.5 text-xs rounded-xs text-neutral-900 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-700 mb-0.5">
                          Phone Number:
                        </label>
                        <input
                          type="tel"
                          required
                          value={callPhone}
                          onChange={(e) => setCallPhone(e.target.value)}
                          placeholder="e.g. (555) 012-3456"
                          className="w-full bg-white border border-neutral-300 focus:border-neutral-900 px-2.5 py-1.5 text-xs rounded-xs text-neutral-900 focus:outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-700 mb-0.5">
                          Organization Domain:
                        </label>
                        <select
                          value={callOrgType}
                          onChange={(e) => setCallOrgType(e.target.value)}
                          className="w-full bg-white border border-neutral-300 focus:border-neutral-900 px-2 py-1.5 text-xs rounded-xs text-neutral-900 focus:outline-none"
                        >
                          <option>Company / Business Enterprise</option>
                          <option>School / Educational Institution</option>
                          <option>Non-Profit / NGO</option>
                          <option>Healthcare / Medical Team</option>
                          <option>Other / Custom Structure</option>
                        </select>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={!callPhone.trim()}
                      className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white py-2 px-3 rounded-xs font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_#064e3b]"
                    >
                      <PhoneCall size={14} />
                      Request Free Call Now
                    </button>
                  </form>
                </>
              )}
            </div>
          )}

          {activeTab === 'text' && (
            <div className="space-y-4">
              {textSubmitted ? (
                <div className="border border-emerald-500 bg-[#f0fdf4] p-4 rounded-xs text-center space-y-2">
                  <div className="w-10 h-10 bg-emerald-700 text-white rounded-full flex items-center justify-center mx-auto">
                    <Check size={20} />
                  </div>
                  <h3 className="font-bold text-sm text-neutral-900">Text Request Received</h3>
                  <p className="text-xs text-neutral-700 leading-relaxed max-w-md mx-auto">
                    Thank you! A helper is reviewing your organization requirements and will text back at <strong>{textContact}</strong> shortly with your completed organizational hierarchy.
                  </p>
                  <button
                    type="button"
                    onClick={() => setTextSubmitted(false)}
                    className="mt-2 text-[11px] text-emerald-800 hover:underline font-semibold"
                  >
                    Send another message
                  </button>
                </div>
              ) : (
                <>
                  {/* SMS Direct Option */}
                  <div className="border border-neutral-300 bg-[#fafaf8] p-3 rounded-xs flex items-center justify-between text-xs">
                    <div>
                      <span className="font-bold text-neutral-900 block">Direct SMS Helpline:</span>
                      <span className="text-[11px] text-neutral-600">Text your structure to: <strong>+1 (800) 555-0199</strong></span>
                    </div>
                    <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 border border-emerald-300 rounded-xs">
                      24/7 SMS
                    </span>
                  </div>

                  {/* In-App Text Form */}
                  <form onSubmit={handleTextSubmit} className="border border-neutral-300 bg-[#fafaf8] p-3.5 rounded-xs space-y-3">
                    <div className="font-bold text-neutral-900 text-xs uppercase tracking-wide">
                      Text What You Want Built
                    </div>
                    <p className="text-[11px] text-neutral-600">
                      Briefly describe the departments, sections, or roles you need. An employee will assemble the flowchart for you:
                    </p>

                    <div className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-neutral-700 mb-0.5">
                            Your Name:
                          </label>
                          <input
                            type="text"
                            value={textName}
                            onChange={(e) => setTextName(e.target.value)}
                            placeholder="e.g. Jordan Lee"
                            className="w-full bg-white border border-neutral-300 focus:border-neutral-900 px-2.5 py-1 text-xs rounded-xs text-neutral-900 focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-neutral-700 mb-0.5">
                            Phone or Email:
                          </label>
                          <input
                            type="text"
                            required
                            value={textContact}
                            onChange={(e) => setTextContact(e.target.value)}
                            placeholder="e.g. (555) 012-3456 or email"
                            className="w-full bg-white border border-neutral-300 focus:border-neutral-900 px-2.5 py-1 text-xs rounded-xs text-neutral-900 focus:outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-neutral-700 mb-0.5">
                          Organization Description / Desired Hierarchy:
                        </label>
                        <textarea
                          required
                          rows={4}
                          value={textMessage}
                          onChange={(e) => setTextMessage(e.target.value)}
                          placeholder="Example: I need an organization for a high school with Principal as top root, 3 sub-departments (Science, Humanities, Administration), and a Physics Section covering Physics Teachers across Grade 11 and 12..."
                          className="w-full bg-white border border-neutral-300 focus:border-neutral-900 px-2.5 py-1.5 text-xs rounded-xs text-neutral-900 focus:outline-none resize-none placeholder:text-neutral-400"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={!textMessage.trim() || !textContact.trim()}
                      className="w-full bg-emerald-700 hover:bg-emerald-800 disabled:opacity-40 text-white py-2 px-3 rounded-xs font-bold text-xs transition-colors flex items-center justify-center gap-1.5 shadow-[2px_2px_0px_#064e3b]"
                    >
                      <Send size={13} />
                      Send Text Request to Employee
                    </button>
                  </form>
                </>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-neutral-200 bg-[#f4f4f2] px-5 py-2.5 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1 text-[11px] text-neutral-500">
            <Shield size={12} className="text-neutral-400" />
            <span>Complimentary human assistance for organization design</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="bg-neutral-900 hover:bg-neutral-800 text-white px-4 py-1 rounded-xs text-xs transition-colors shadow-[1.5px_1.5px_0px_#71717a]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
