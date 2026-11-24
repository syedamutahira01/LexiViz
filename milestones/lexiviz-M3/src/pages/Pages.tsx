import { Link } from 'react-router-dom';
import { PipelineNavigator } from '../components/PipelineNavigator';

export function Home() {
  return (
    <div className="page home">
      <section className="hero">
        <h1>See how a compiler reads text.</h1>
        <p className="lead">LexiViz runs the real algorithms of Automata Theory and Compiler Construction and shows every step they take.</p>
        <div className="cards">
          <Link className="panel card" to="/automata"><h2>Automata Lab</h2><p>Regex to NFA to DFA to minimal DFA, with a string tester.</p></Link>
          <Link className="panel card" to="/lexer"><h2>Lexer Lab</h2><p>Source code to tokens and a symbol table.</p></Link>
          <Link className="panel card" to="/parser"><h2>Parser Lab</h2><p>Tokens to a parse tree for a small grammar.</p></Link>
        </div>
        <a className="scroll-hint" href="#pipeline" onClick={(e) => { e.preventDefault(); document.getElementById('pipeline')?.scrollIntoView({ behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); }}>Explore the compiler pipeline ↓</a>
      </section>
      <PipelineNavigator />
    </div>
  );
}

export function ComingSoon({ title, milestone, text }: { title: string; milestone: string; text: string }) {
  return (
    <div className="page">
      <h1>{title}</h1>
      <p className="empty" role="status">{text} This lab is built in milestone {milestone}.</p>
    </div>
  );
}

export function About() {
  return (
    <div className="page">
      <h1>About LexiViz</h1>
      <section className="panel">
        <p>Every graph, tree and table is produced by the real algorithm. Each algorithm returns its result and an ordered trace of steps, and the screen only reads that trace.</p>
        <p>Regular expressions and finite automata describe lexical patterns. A lexer uses pattern rules to produce tokens. The symbol table is a separate structure. LexiViz shows them as separate topics.</p>
        <h2>Known limitations</h2>
        <ul>
          <li>Regex syntax is limited to symbols, concatenation, |, *, parentheses and ε.</li>
          <li>The DFA omits the dead state: a missing transition means the string is rejected.</li>
          <li>The lexer has no comments, strings or decimals, and the parser covers only declarations, assignments and arithmetic.</li>
          <li>Voice narration and music are not part of this build yet. The 3D background is optional and can be switched off in the sidebar.</li>
        </ul>
      </section>
    </div>
  );
}
