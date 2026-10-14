import sezzleLogo from './assets/sezzle-logo.svg'
import { Calculator } from './components/Calculator'
import { messages } from './messages'

export default function App() {
  const { app, shortcuts } = messages

  return (
    <div className="page">
      <header className="header">
        <div className="header__brand">
          <img className="header__sezzle" src={sezzleLogo} alt={app.sezzleLogoAlt} />
          <span className="header__logo">{app.logo}</span>
        </div>
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
