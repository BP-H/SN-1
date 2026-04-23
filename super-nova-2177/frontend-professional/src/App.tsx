import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { MobileLayout } from './components/MobileLayout';
import { Feed } from './pages/Feed';
import { Network } from './pages/Network';
import { Notifications } from './pages/Notifications';
import { Jobs } from './pages/Jobs';
import { Profile } from './pages/Profile';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route element={<MobileLayout />}>
            <Route path="/" element={<Feed />} />
            <Route path="/network" element={<Network />} />
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/jobs" element={<Jobs />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
