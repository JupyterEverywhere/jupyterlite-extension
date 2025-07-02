import React from 'react';

/**
 * Warning banner displayed at the bottom of the Files widget.
 */
export const FilesWarningBanner: React.FC = () => {
  return (
    <div className="je-WarningBanner">
      <div className="je-WarningBanner-content">
        <strong>WARNING:</strong> To save memory, all data and image files are discarded after each
        session. Please upload your data each time you use your notebook. Note: images rendered in
        the notebook will persist between sessions.
      </div>
    </div>
  );
};
