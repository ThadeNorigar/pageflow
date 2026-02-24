import React, { useEffect, useState } from 'react';
import { invoke } from '@forge/bridge';

interface StatusResponse {
  status: string;
  version: string;
}

const App: React.FC = () => {
  const [status, setStatus] = useState<StatusResponse | null>(null);

  useEffect(() => {
    invoke<StatusResponse>('getStatus').then(setStatus);
  }, []);

  return (
    <div style={{ padding: '24px' }}>
      <h1>ConfluenceImporter</h1>
      <p>Content-Migration nach Confluence</p>
      {status && (
        <p>
          Status: {status.status} | Version: {status.version}
        </p>
      )}
    </div>
  );
};

export default App;
