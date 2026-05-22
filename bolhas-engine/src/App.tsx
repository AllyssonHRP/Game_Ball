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
      <h1 style={{ color: '#fff', textShadow: '0 0 10px #ff1e27', fontSize: '2.5rem', marginBottom: '30px' }}>
        Arena Battle Anime
        </h1>
      
      {/* Aqui é onde a mágica acontece */}
      <BattleEngine />
      
    </div>
  );
}

export default App;