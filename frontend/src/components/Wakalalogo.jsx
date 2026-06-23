import React from 'react';

const WakalaLogo = () => {
  return (
    <div className="inline-flex items-center gap-2 mb-2">
      <img 
        src="/wakalabot_logo.png" 
        alt="WakalaBot Logo" 
        className="w-14 h-14 rounded-2xl object-cover shadow-lg shadow-emerald-900/40"
      />
      <span className="text-2xl font-bold text-indigo-500">WakalaBot</span>
    </div>
  );
};

export default WakalaLogo;