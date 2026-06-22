import { useEffect, useRef, useState } from 'react'

const WS_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/^http/, 'ws') + '/ws'
  : 'ws://localhost:8000/ws'

export function useWebSocket(onMessage) {
  const [connected, setConnected] = useState(false)
  const wsRef = useRef(null)
  const reconnectTimer = useRef(null)
  const onMessageRef = useRef(onMessage)

  useEffect(() => {
    onMessageRef.current = onMessage
  }, [onMessage])

  useEffect(() => {
    function connect() {
      const ws = new WebSocket(WS_URL)
      wsRef.current = ws

      ws.onopen = () => setConnected(true)

      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data)
          onMessageRef.current(data)
        } catch {
          // ignore malformed frames
        }
      }

      ws.onclose = () => {
        setConnected(false)
        reconnectTimer.current = setTimeout(connect, 3000)
      }

      ws.onerror = () => ws.close()
    }

    connect()

    return () => {
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [])

  return connected
}
