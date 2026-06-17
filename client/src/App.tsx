import { AssetType } from '@cast/types';

function App() {
  return (
    <div>
      <h1>Cast Studio v2</h1>
      <p>Shared types loaded: {Object.values(AssetType).join(', ')}</p>
    </div>
  );
}

export default App;
