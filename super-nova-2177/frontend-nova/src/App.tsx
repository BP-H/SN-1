
import { useAuth } from './context/AuthContext';
import { Login } from './components/Login';
import { Layout } from './components/Layout';
import { Loader2 } from 'lucide-react';

function App() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="app-container" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={48} className="animate-spin" color="var(--brand-cyan)" />
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return <Layout />;
}

export default App;
