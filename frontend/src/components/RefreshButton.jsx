import React from 'react';

function RefreshButton() {
  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <button 
      onClick={handleRefresh}
      className="refresh-btn text-indigo-600"
    >
      Refresh Page
    </button>
  );
}

export default RefreshButton;