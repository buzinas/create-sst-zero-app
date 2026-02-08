import { useConnectionState } from '@rocicorp/zero/react'

import { APP_NAME } from '@app/core/index'

const stateColors: Record<string, string> = {
  connected: 'bg-green-500',
  connecting: 'bg-yellow-500',
  disconnected: 'bg-red-500',
  'needs-auth': 'bg-orange-500',
  error: 'bg-red-500',
  closed: 'bg-gray-500',
}

export default function Home() {
  const connectionState = useConnectionState()

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-4xl font-bold">Hello, {APP_NAME}!</h1>
      <div className="flex items-center gap-2 text-sm text-gray-600">
        <span
          className={`inline-block size-2 rounded-full ${stateColors[connectionState.name] ?? 'bg-gray-400'}`}
        />
        Zero: {connectionState.name}
      </div>
    </main>
  )
}
