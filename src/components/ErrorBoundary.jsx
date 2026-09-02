import { Component } from 'react'

/** Keeps one broken render from blanking the whole page in production. */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    console.error('Unhandled UI error', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="empty" style={{ height: '100vh' }}>
        <div>
          <h2>Something broke in the interface</h2>
          <p>The error was logged to the browser console. Reloading usually clears it.</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      </div>
    )
  }
}
