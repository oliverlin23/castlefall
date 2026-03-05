import { useState, useEffect, useCallback } from 'react';
import { RoomPage } from './RoomPage';

function getHashRoom(): string {
  const hash = window.location.hash.replace(/^#\/?/, '').trim();
  return hash || 'default';
}

export default function App() {
  const [roomName, setRoomName] = useState(getHashRoom);

  useEffect(() => {
    function handleHashChange() {
      setRoomName(getHashRoom());
    }
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleChangeRoom = useCallback((name: string) => {
    window.location.hash = `#${name}`;
    setRoomName(name);
  }, []);

  return <RoomPage key={roomName} roomName={roomName} onChangeRoom={handleChangeRoom} />;
}
