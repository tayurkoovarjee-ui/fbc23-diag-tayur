interface Props {
  email: string;
  onSignOut: () => void;
}

export default function AppHeader({ email, onSignOut }: Props) {
  return (
    <header className="topbar">
      <h1>Mini Task Tracker</h1>
      <div className="topbar-user">
        <span className="muted">{email}</span>
        <button type="button" className="btn" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </header>
  );
}
