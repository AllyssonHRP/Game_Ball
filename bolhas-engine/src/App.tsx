import BattleEngine from './BattleEngine';

function App() {
  return (
    <div style={{ 
      backgroundColor: '#000', 
      minHeight: '100vh', 
      display: 'flex', 
      flexDirection: 'column', 
      alignItems: 'center',
      justifyContent: 'center',
      margin: 0,
      padding: 0
    }}>
      <h1 style={{ color: '#fff', fontFamily: 'sans-serif', marginBottom: '20px' }}>
        Arena Matter.js
      </h1>
      
      {/* Aqui é onde a mágica acontece */}
      <BattleEngine />
      
    </div>
  );
}

export default App;