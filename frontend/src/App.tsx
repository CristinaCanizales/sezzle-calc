import { Calculator } from './components/Calculator'

export default function App() {
  return (
    <div className="page">
      <header className="header">
        <span className="header__logo">calc</span>
      </header>
      <main className="main">
        <h1 className="title">Quick math, no surprises.</h1>
        <p className="subtitle">A simple calculator powered by a Go API.</p>
        <Calculator />
        <p className="shortcuts">
          Keyboard: <kbd>0–9</kbd> <kbd>.</kbd> <kbd>+</kbd> <kbd>-</kbd> <kbd>*</kbd> <kbd>/</kbd>{' '}
          <kbd>^</kbd> <kbd>%</kbd> · <kbd>R</kbd> √ · <kbd>N</kbd> ± · <kbd>Enter</kbd> = ·{' '}
          <kbd>Backspace</kbd> · <kbd>Esc</kbd> clear
        </p>
      </main>
    </div>
  )
}
