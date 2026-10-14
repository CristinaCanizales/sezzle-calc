import { Calculator } from './components/Calculator'
import { strings } from './strings'

export default function App() {
  const { app, shortcuts } = strings

  return (
    <div className="page">
      <header className="header">
        <span className="header__logo">{app.logo}</span>
      </header>
      <main className="main">
        <h1 className="title">{app.title}</h1>
        <p className="subtitle">{app.subtitle}</p>
        <Calculator />
        <p className="shortcuts">
          {shortcuts.label}
          {shortcuts.groups.map(({ keys, action }) => (
            <span key={keys.join()} className="shortcuts__group">
              {keys.map((key) => (
                <kbd key={key}>{key}</kbd>
              ))}
              {action}
            </span>
          ))}
        </p>
      </main>
    </div>
  )
}
