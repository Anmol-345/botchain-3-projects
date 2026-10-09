/**
 * Garde-fou : une erreur de rendu ne doit JAMAIS produire un écran noir
 * pendant une démo. On affiche le message, la pile, et un bouton pour repartir.
 */
import { Component, type ErrorInfo, type ReactNode } from 'react'

interface State {
  error: Error | null
  info: string
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null, info: '' }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[GORA] erreur de rendu :', error, info)
    this.setState({ info: info.componentStack ?? '' })
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="min-h-screen p-6 text-sm">
        <h1 className="text-lg font-semibold text-red-400 mb-3">Rendering error</h1>
        <pre className="mono text-xs whitespace-pre-wrap bg-zinc-900 border border-red-900 rounded p-4 text-red-300 overflow-x-auto">
          {this.state.error.message}
        </pre>
        <pre className="mono text-[10px] whitespace-pre-wrap text-zinc-500 mt-3 max-h-60 overflow-auto">
          {this.state.info}
        </pre>
        <button
          onClick={() => this.setState({ error: null, info: '' })}
          className="mt-4 px-4 py-2 rounded bg-violet-600 hover:bg-violet-500 font-medium"
        >
          Retry
        </button>
      </div>
    )
  }
}
