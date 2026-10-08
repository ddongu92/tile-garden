import { useEffect } from 'react';
import { Route, Routes } from 'react-router-dom';
import { APP_NAME } from './config';
import { Home } from './pages/Home';
import { LocalGame } from './pages/LocalGame';
import { Room } from './pages/Room';

export function App() {
  useEffect(() => {
    document.title = APP_NAME;
  }, []);
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/local" element={<LocalGame />} />
      <Route path="/r/:code" element={<Room />} />
      <Route path="*" element={<Home />} />
    </Routes>
  );
}
