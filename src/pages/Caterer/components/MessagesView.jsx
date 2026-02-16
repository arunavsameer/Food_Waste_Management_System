import React from 'react';

const MessagesView = () => {
  return (
    <div className="admin-messages-card" style={{ maxWidth: '600px' }}>
      <h4>Admin Messages</h4>
      <div className="message-item">
        <span className="sender">Admin</span>
        <span className="time">Today, 10:00 AM</span>
        <p className="body">
          Please reduce the quantity of rice prepared for dinner today. Student turnout expected to be low due to fest.
        </p>
      </div>
      <div className="message-item">
        <span className="sender">Admin</span>
        <span className="time">Yesterday</span>
        <p className="body">
          Review scores for lunch were excellent! Keep it up.
        </p>
      </div>
    </div>
  );
};

export default MessagesView;
