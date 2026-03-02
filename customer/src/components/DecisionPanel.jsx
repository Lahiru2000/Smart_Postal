import React, { useState } from 'react';
import { RotateCcw, Users, Archive, ArrowRight, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { submitDecision } from '../services/api';

const DecisionPanel = ({ callSessionId, shipmentId }) => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const decisions = [
    {
      type: 'return',
      label: 'Return Package',
      description: 'Send the package back to the sender',
      icon: <RotateCcw className="w-8 h-8" />,
      color: 'text-red-400',
      bgHover: 'hover:bg-red-500/10',
    },
    {
      type: 'neighbor',
      label: 'Give to Neighbor',
      description: 'Deliver to a trusted neighbor nearby',
      icon: <Users className="w-8 h-8" />,
      color: 'text-blue-400',
      bgHover: 'hover:bg-blue-500/10',
    },
    {
      type: 'locker',
      label: 'Place in Locker',
      description: 'Store in a secure pickup locker',
      icon: <Archive className="w-8 h-8" />,
      color: 'text-green-400',
      bgHover: 'hover:bg-green-500/10',
    },
  ];

  const handleSubmit = async () => {
    if (!selected) return;
    setLoading(true);
    setError('');
    try {
      await submitDecision({
        call_session_id: callSessionId,
        decision: selected,
        notes: notes || null,
      });
      setSubmitted(true);
      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to submit decision');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="text-center py-16">
        <CheckCircle className="w-20 h-20 text-green-400 mx-auto mb-6" />
        <h3 className="text-3xl font-bold text-white mb-3">Decision Submitted</h3>
        <p className="text-gray-400 text-lg">Redirecting to dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h3 className="text-3xl font-bold text-white mb-3">Delivery Decision</h3>
        <p className="text-gray-400 text-lg">What would you like to do with your package?</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {decisions.map((d) => (
          <button
            key={d.type}
            onClick={() => setSelected(d.type)}
            className={`p-8 rounded-2xl border-2 text-left transition-all duration-200 ${
              selected === d.type
                ? 'border-[#FFC000] bg-[#FFC000]/10 scale-[1.02]'
                : `border-[#333333] bg-[#1A1A1A] ${d.bgHover}`
            }`}
          >
            <div className={`mb-5 ${selected === d.type ? 'text-[#FFC000]' : d.color}`}>
              {d.icon}
            </div>
            <h4 className="font-bold text-white text-lg mb-1">{d.label}</h4>
            <p className="text-sm text-gray-400">{d.description}</p>
          </button>
        ))}
      </div>

      <div className="space-y-2">
        <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">
          Additional Notes (Optional)
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows="3"
          placeholder="Any special instructions for the courier..."
          className="w-full bg-black border border-[#333333] rounded-xl p-4 text-white placeholder-gray-600 focus:border-[#FFC000] focus:outline-none transition-colors resize-none"
        />
      </div>

      {error && (
        <p className="text-red-400 text-sm bg-red-500/10 border border-red-500/20 p-3 rounded-lg">{error}</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={!selected || loading}
        className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all ${
          selected && !loading
            ? 'bg-[#FFC000] text-black hover:bg-[#E5AC00] shadow-lg shadow-[#FFC000]/20'
            : 'bg-[#333333] text-gray-500 cursor-not-allowed'
        }`}
      >
        {loading ? 'Submitting...' : 'Confirm Decision'} <ArrowRight size={22} />
      </button>
    </div>
  );
};

export default DecisionPanel;
