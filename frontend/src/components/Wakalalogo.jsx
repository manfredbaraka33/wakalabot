import React from 'react';

const WakalaLogo = () => {
  return (
    <div className="inline-flex items-center gap-2 mb-2">
      <img 
        src="/wakalabot_logo.png" 
        alt="WakalaBot Logo" 
        className="w-12 h-12 "
      />
      <span className="text-2xl font-bold text-indigo-500">Wakalabot</span>
    </div>
  );
};

export default WakalaLogo;