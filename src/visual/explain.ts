/** Turns real trace events into plain-language explanations in English, Urdu, or Roman Urdu. Reads traces only; never recomputes algorithm results. */
import type { StepEvent } from '../algorithms';

const set = (xs: unknown) => `{${(xs as number[]).join(', ')}}`;

export function explainParse(s: StepEvent, lang = 'en'): string {
  const p = s.payload;
  const isUrdu = lang === 'ur';
  const isRoman = lang === 'ur-roman';

  switch (s.kind) {
    case 'token': {
      if (isUrdu) return `ٹوکنائزر نے پوزیشن ${(p.position as number) + 1} پر '${p.value}' کو بطور ${p.type} اسکین کیا۔`;
      if (isRoman) return `Tokenizer ne position ${(p.position as number) + 1} par '${p.value}' ko ${p.type} ke tor par scan kiya.`;
      return `Tokenizer read '${p.value}' at position ${(p.position as number) + 1} as token type ${p.type}.`;
    }
    case 'node': {
      const kids = p.children as number[] | undefined;
      if (p.type === 'symbol') {
        if (isUrdu) return `پارسر نے ٹرمینل علامت '${p.value}' کے لیے لیف نوڈ #${p.id} بنایا۔`;
        if (isRoman) return `Parser ne terminal alamat '${p.value}' ke liye leaf node #${p.id} banaya.`;
        return `Parser created leaf node #${p.id}: symbol '${p.value}'.`;
      }
      if (p.type === 'epsilon') {
        if (isUrdu) return `پارسر نے خالی اسٹرنگ ایپسیلون (ε) کے لیے لیف نوڈ #${p.id} بنایا۔`;
        if (isRoman) return `Parser ne khali string epsilon (ε) ke liye leaf node #${p.id} banaya.`;
        return `Parser created leaf node #${p.id}: epsilon (the empty string).`;
      }
      if (isUrdu) return `پارسر نے نوڈز ${kids?.map((k) => `#${k}`).join(' اور ')} سے ${p.type} نوڈ #${p.id} تشکیل دیا۔`;
      if (isRoman) return `Parser ne nodes ${kids?.map((k) => `#${k}`).join(' aur ')} se ${p.type} node #${p.id} tashkeel diya.`;
      return `Parser created ${p.type} node #${p.id} from ${kids?.map((k) => `#${k}`).join(' and ')}.`;
    }
    default: {
      if (isUrdu) return `پارسنگ کامیابی سے مکمل ہوئی۔ اس سنٹیکس ٹری کا بنیادی روٹ نوڈ #${p.root} ہے۔`;
      if (isRoman) return `Parsing kamyabi se mukammal hui. Is syntax tree ka bunyadi root node #${p.root} hai.`;
      return `Parsing finished. The root of the AST is node #${p.root}.`;
    }
  }
}

export function explainNfa(s: StepEvent, lang = 'en'): string {
  const p = s.payload;
  const isUrdu = lang === 'ur';
  const isRoman = lang === 'ur-roman';

  if (s.kind === 'done') {
    if (isUrdu) return `تھامپسن کنسٹرکشن مکمل ہو گئی۔ شروعاتی حالت q${p.start} ہے اور واحد قبول کرنے والی حالت q${p.accept} ہے۔`;
    if (isRoman) return `Thompson construction mukammal ho gayi. Start state q${p.start} hai aur wahid accepting state q${p.accept} hai.`;
    return `Construction finished. Start state q${p.start}, the only accepting state is q${p.accept}.`;
  }

  const t = p.astType as string;
  const headEn = `Fragment for AST node #${p.astId} (${t}): start q${p.start}, accept q${p.accept}.`;
  const headUr = `AST نوڈ #${p.astId} (${t}) کے لیے فریگمنٹ: شروعات q${p.start}، قبولیت q${p.accept}۔`;
  const headRoman = `AST node #${p.astId} (${t}) ke liye fragment: start q${p.start}, accept q${p.accept}.`;

  const whyEn: Record<string, string> = {
    symbol: 'Two new states joined by one edge labelled with the symbol.',
    epsilon: 'Two new states joined by an ε edge.',
    concat: 'The accept state of the left fragment is bridged to the start of the right fragment with an ε edge.',
    union: 'A new start state branches by ε into both fragments, and both accept states join a new accept state by ε.',
    star: 'A new start and accept state are added; ε edges allow skipping the fragment or repeating it.',
  };
  const whyUr: Record<string, string> = {
    symbol: 'دو نئی states علامت کے لیبل والے تیر سے جوڑی گئیں۔',
    epsilon: 'دو نئی states ایک ε ٹرانزیشن سے جوڑی گئیں۔',
    concat: 'بائیں فریگمنٹ کی accept state کو دائیں فریگمنٹ کی start state سے ε ایج سے جوڑ دیا گیا۔',
    union: 'ایک نئی start state دونوں حصوں میں شاخیں نکالتی ہے اور دونوں کے نتائج ایک نئی accept state میں ملتے ہیں۔',
    star: 'نئی start اور accept states شامل ہوئیں؛ ε ایجز سے دہرائی یا آگے بڑھنا ممکن ہوتا ہے۔',
  };
  const whyRoman: Record<string, string> = {
    symbol: 'Do nayi states alamat ke label wale teer se jori gayin.',
    epsilon: 'Do nayi states aik ε transition se jori gayin.',
    concat: 'Baen fragment ki accept state ko daen fragment ki start state se ε edge se jor diya gaya.',
    union: 'Aik nayi start state dono hisson mein shakhain nikalti hai aur dono ke nataij aik nayi accept state mein miltay hain.',
    star: 'Nayi start aur accept states shamil huin; ε edges se repeat karna ya skip karna mumkin hota hai.',
  };

  if (isUrdu) return `${headUr} ${whyUr[t] ?? ''}`;
  if (isRoman) return `${headRoman} ${whyRoman[t] ?? ''}`;
  return `${headEn} ${whyEn[t] ?? ''}`;
}

export function explainDfa(s: StepEvent, lang = 'en'): string {
  const p = s.payload;
  const isUrdu = lang === 'ur';
  const isRoman = lang === 'ur-roman';

  switch (s.kind) {
    case 'startClosure': {
      if (isUrdu) return `NFA کی شروعاتی حالت q${p.from} کا ε-closure یہ ہے: ${set(p.closure)}۔`;
      if (isRoman) return `NFA ki start state q${p.from} ka ε-closure yeh hai: ${set(p.closure)}.`;
      return `ε-closure of the NFA start state q${p.from} is ${set(p.closure)}.`;
    }
    case 'newState': {
      if (isUrdu) return `نئی DFA حالت ${p.label} دراصل NFA کی ان states پر مشتمل ہے: ${set(p.members)}${p.accepting ? ' اور یہ accepting ہے (کیونکہ اس میں NFA کی accept state شامل ہے)' : ''}۔`;
      if (isRoman) return `Nayi DFA state ${p.label} NFA states ${set(p.members)} par mushtamil hai${p.accepting ? ' aur accepting hai (kyunke is mein NFA ki accept state shamil hai)' : ''}.`;
      return `New DFA state ${p.label} represents NFA states ${set(p.members)}${p.accepting ? ' and is accepting (it contains the NFA accept state)' : ''}.`;
    }
    case 'move': {
      if (isUrdu) return `حالت D${p.from} سے علامت '${p.symbol}' پر: منتقلی سے ${set(p.moved)} ملا، اور ε-closure سے ${set(p.closure)} حاصل ہوا، جو کہ ${p.isNew ? 'نئی دریافت شدہ حالت' : 'پہلے سے موجود حالت'} D${p.to} ہے۔`;
      if (isRoman) return `D${p.from} se '${p.symbol}' par: move se ${set(p.moved)} mila, ε-closure se ${set(p.closure)} mila, jo ke ${p.isNew ? 'nayi daryaft shuda state' : 'pehle se mojood state'} D${p.to} hai.`;
      return `From D${p.from} on '${p.symbol}': move gives ${set(p.moved)}, ε-closure gives ${set(p.closure)}, which is ${p.isNew ? 'a newly discovered state' : 'an existing state'} D${p.to}.`;
    }
    case 'noTransition': {
      if (isUrdu) return `حالت D${p.from} سے علامت '${p.symbol}' پر: کوئی NFA حالت آگے نہیں بڑھ سکتی، لہٰذا کوئی ٹرانزیشن نہیں ہے (غیر متحرک ڈیڈ اسٹیٹ)۔`;
      if (isRoman) return `D${p.from} se '${p.symbol}' par: koi transition nahi hai (implicit dead state).`;
      return `From D${p.from} on '${p.symbol}': no NFA state can move, so there is no transition (implicit dead state).`;
    }
    default: {
      if (isUrdu) return `سب سیٹ کنسٹرکشن مکمل ہوئی، جس سے کل ${p.stateCount} DFA states حاصل ہوئیں۔`;
      if (isRoman) return `Subset construction mukammal hui ${p.stateCount} DFA states ke sath.`;
      return `Subset construction finished with ${p.stateCount} DFA states.`;
    }
  }
}

const groupsText = (gs: unknown) => (gs as number[][]).map((g) => `{${g.map((x) => `D${x}`).join(', ')}}`).join('  ');

export function explainMin(s: StepEvent, lang = 'en'): string {
  const p = s.payload;
  const isUrdu = lang === 'ur';
  const isRoman = lang === 'ur-roman';

  switch (s.kind) {
    case 'removeUnreachable': {
      const removed = p.removed as number[];
      if (isUrdu) return removed.length ? `غیر ضروری حالتیں ہٹا دی گئیں: ${removed.map((x) => `D${x}`).join(', ')}۔` : 'ہٹانے کے لیے کوئی غیر ضروری حالت نہیں ملی۔';
      if (isRoman) return removed.length ? `Unreachable states hata di gayin: ${removed.map((x) => `D${x}`).join(', ')}.` : 'Koi unreachable states nahi milin.';
      return removed.length ? `Removed unreachable states: ${removed.map((x) => `D${x}`).join(', ')}.` : 'No unreachable states to remove.';
    }
    case 'initialPartition': {
      if (isUrdu) return `ابتدائی پارٹیشن (non-accepting بمقابلہ accepting): ${groupsText(p.groups)}۔`;
      if (isRoman) return `Ibtidai partition (non-accepting ba-muqabla accepting): ${groupsText(p.groups)}.`;
      return `Initial partition (non-accepting vs accepting): ${groupsText(p.groups)}.`;
    }
    case 'refine': {
      if (isUrdu) return `ریفائنمنٹ راؤنڈ ${p.round}: ${groupsText(p.groups)}۔ ${p.changed ? 'ایک گروپ تقسیم ہوا، دوبارہ جانچ کریں۔' : 'کوئی تبدیلی نہیں ہوئی، پارٹیشن مستحکم ہے۔'}`;
      if (isRoman) return `Refinement round ${p.round}: ${groupsText(p.groups)}. ${p.changed ? 'Group split hua, dobara refine karein.' : 'Koi tabdeeli nahi hui, partition stable hai.'}`;
      return `Refinement round ${p.round}: ${groupsText(p.groups)}. ${p.changed ? 'Some group was split, so refine again.' : 'Nothing changed, so the partition is stable.'}`;
    }
    default: {
      if (isUrdu) return `ہر گروپ ایک منفرد حالت بن گیا، جس سے کل ${p.stateCount} states بنیں۔`;
      if (isRoman) return `Har group aik state ban gaya, kul ${p.stateCount} states bani.`;
      return `Each group became one state, giving ${p.stateCount} states.`;
    }
  }
}

export function explainRun(s: StepEvent, label: (id: number) => string, lang = 'en'): string {
  const p = s.payload;
  const isUrdu = lang === 'ur';
  const isRoman = lang === 'ur-roman';

  switch (s.kind) {
    case 'start': {
      if (isUrdu) return `شروعاتی حالت ${label(p.state as number)} سے جانچ شروع ہوئی۔`;
      if (isRoman) return `Start state ${label(p.state as number)} se shuruat hui.`;
      return `Start in state ${label(p.state as number)}.`;
    }
    case 'step': {
      if (isUrdu) return `علامت '${p.symbol}' پڑھی (پوزیشن ${(p.index as number) + 1}): ${label(p.from as number)} → ${label(p.to as number)}۔`;
      if (isRoman) return `Read '${p.symbol}' (position ${(p.index as number) + 1}): ${label(p.from as number)} → ${label(p.to as number)}.`;
      return `Read '${p.symbol}' (position ${(p.index as number) + 1}): ${label(p.from as number)} → ${label(p.to as number)}.`;
    }
    case 'stuck': {
      if (isUrdu) return `علامت '${p.symbol}' پڑھی (پوزیشن ${(p.index as number) + 1}): حالت ${label(p.from as number)} سے کوئی ٹرانزیشن نہیں ہے، لہٰذا اسٹرنگ مسترد ہوئی۔`;
      if (isRoman) return `Read '${p.symbol}' (position ${(p.index as number) + 1}): state ${label(p.from as number)} has no transition, string reject ho gayi.`;
      return `Read '${p.symbol}' (position ${(p.index as number) + 1}): state ${label(p.from as number)} has no transition on it, so the string is rejected.`;
    }
    default: {
      if (p.accepted) {
        if (isUrdu) return `ان پٹ قبول کرنے والی حالت ${label(p.state as number)} میں مکمل ہوئی: ACCEPTED (قبول)۔`;
        if (isRoman) return `Input accepting state ${label(p.state as number)} mein mukammal hui: ACCEPTED.`;
        return `Input consumed in accepting state ${label(p.state as number)}: ACCEPTED.`;
      }
      if (isUrdu) return `عمل غیر قبول حالت ${label(p.state as number)} پر رک گیا: REJECTED (مسترد)۔`;
      if (isRoman) return `Non-accepting state ${label(p.state as number)} par ruk gaya: REJECTED.`;
      return `Stopped in state ${label(p.state as number)}: REJECTED.`;
    }
  }
}

export function explainLex(s: StepEvent, lang = 'en'): string {
  const p = s.payload;
  const isUrdu = lang === 'ur';
  const isRoman = lang === 'ur-roman';

  if (s.kind === 'error') {
    if (isUrdu) return `غیر متوقع حرف '${p.char}' لائن ${p.line}، کالم ${p.column} پر ملا۔ لیکسر نے اسے رپورٹ کیا، نظر انداز کیا اور اسکیننگ جاری رکھی۔`;
    if (isRoman) return `Unexpected character '${p.char}' line ${p.line}, column ${p.column} par mila. Lexer isay report kar ke aage barhta hai.`;
    return `Unexpected character '${p.char}' at line ${p.line}, column ${p.column}. The lexer reports it and skips it, then keeps scanning.`;
  }

  const cands = p.candidates as { rule: string; length: number }[];
  const headEn = `At line ${p.line}, column ${p.column} the lexer matched '${p.lexeme}' as ${p.type}.`;
  const headUr = `لائن ${p.line}، کالم ${p.column} پر لیکسر نے '${p.lexeme}' کو بطور ${p.type} میچ کیا۔`;
  const headRoman = `Line ${p.line}, column ${p.column} par lexer ne '${p.lexeme}' ko ${p.type} ke tor par match kiya.`;

  if (cands.length <= 1) {
    if (isUrdu) return `${headUr} یہاں صرف ${p.rule} کا رول میچ ہوا۔`;
    if (isRoman) return `${headRoman} Yahan sirf ${p.rule} rule match hua.`;
    return `${headEn} Only the ${p.rule} rule matched here.`;
  }

  const list = cands.map((c) => `${c.rule} (${c.length})`).join(', ');
  const top = Math.max(...cands.map((c) => c.length));
  const tied = cands.filter((c) => c.length === top).length > 1;

  if (isUrdu) return `${headUr} ممکنہ رولز: ${list}۔ ${tied ? `مساوی لمبائی ہونے کی وجہ سے پہلے درج رول کو فوقیت ملی: ${p.rule}۔` : `میکسیمل منچ (سب سے لمبا میچ) کے تحت یہ رول منتخب ہوا: ${p.rule}۔`}`;
  if (isRoman) return `${headRoman} Candidate rules: ${list}. ${tied ? `Barabar lambai par pehle darj rule ko preference mili: ${p.rule}.` : `Longest match rule jeet gaya: ${p.rule}.`}`;
  return `${headEn} Candidate rules: ${list}. ${tied ? `Equal length, so the rule listed first wins: ${p.rule}.` : `The longest match wins: ${p.rule}.`}`;
}

export function explainParseRule(s: StepEvent, lang = 'en'): string {
  const p = s.payload;
  const isUrdu = lang === 'ur';
  const isRoman = lang === 'ur-roman';

  switch (s.kind) {
    case 'enter': {
      if (isUrdu) return `گرامر رول ${p.rule} میں داخلہ۔ اگلا ٹوکن: ${p.lookahead === null ? 'ان پٹ کا اختتام' : '\'' + p.lookahead + '\''}۔`;
      if (isRoman) return `Grammar rule ${p.rule} mein dakhila. Agla token: ${p.lookahead === null ? 'end of input' : `'${p.lookahead}'`}.`;
      return `Enter rule ${p.rule}. Next token: ${p.lookahead === null ? 'end of input' : `'${p.lookahead}'`}.`;
    }
    case 'match': {
      if (isUrdu) return `ٹوکن ${p.type} '${p.lexeme}' (لائن ${p.line}، کالم ${p.column}) میچ ہوا اور اگلے ٹوکن پر بڑھ گیا۔`;
      if (isRoman) return `Matched ${p.type} '${p.lexeme}' (line ${p.line}, column ${p.column}) aur agle token par barh gaya.`;
      return `Matched ${p.type} '${p.lexeme}' (line ${p.line}, column ${p.column}) and moved to the next token.`;
    }
    case 'exit': {
      if (isUrdu) return `رول ${p.rule} مکمل ہوا۔ کنٹرول پچھلے بلانے والے رول کو واپس مل گیا۔`;
      if (isRoman) return `Finished rule ${p.rule}. Control pichhle caller rule ko wapas mila.`;
      return `Finished rule ${p.rule}. Control returns to the rule that called it.`;
    }
    case 'error': {
      if (isUrdu) return `لائن ${p.line}، کالم ${p.column} پر سنٹیکس ایرر: ${p.message}۔`;
      if (isRoman) return `Syntax error line ${p.line}, column ${p.column} par: ${p.message}.`;
      return `Syntax error at line ${p.line}, column ${p.column}: ${p.message}.`;
    }
    default: {
      if (p.ok) {
        if (isUrdu) return 'تمام ٹوکنز کامیابی سے گرامر کے مطابق پروسیس ہو گئے: پروگرام درست ہے۔';
        if (isRoman) return 'Tamam tokens process ho gaye: program syntactically valid hai.';
        return 'The whole token stream was consumed: the program is valid.';
      }
      if (isUrdu) return 'پہلی سنٹیکس کی غلطی پر پارسنگ رک گئی۔';
      if (isRoman) return 'Pehli syntax ghalti par parsing ruk gayi.';
      return 'Parsing stopped at the first syntax error.';
    }
  }
}
