import { NavLink, Route, Routes } from 'react-router-dom';
import { BookOpen, Braces, Cpu, GitBranch, Home as HomeIcon } from 'lucide-react';
import AutomataLab from './pages/AutomataLab';
import { About, ComingSoon, Home } from './pages/Pages';

const NAV = [
  { to: '/', label: 'Home', icon: HomeIcon }, { to: '/automata', label: 'Automata Lab', icon: Cpu },
  { to: '/lexer', label: 'Lexer Lab', icon: Braces }, { to: '/parser', label: 'Parser Lab', icon: GitBranch }, { to: '/about', label: 'About', icon: BookOpen },
];

export default function App() {
  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Main">
        <div className="brand">LexiViz</div>
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'} className={({ isActive }) => (isActive ? 'nav on' : 'nav')}><Icon size={18} aria-hidden="true" /> {label}</NavLink>
        ))}
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/automata" element={<AutomataLab />} />
          <Route path="/lexer" element={<ComingSoon title="Lexer Lab" milestone="M2" text="Source code to tokens, with line and column numbers and a symbol table." />} />
          <Route path="/parser" element={<ComingSoon title="Parser Lab" milestone="M2" text="Tokens to a parse tree for a small grammar." />} />
          <Route path="/about" element={<About />} />
          <Route path="*" element={<ComingSoon title="Page not found" milestone="n/a" text="Use the sidebar to pick a page." />} />
        </Routes>
      </main>
    </div>
  );
}
