(function () {
  var CONTEUDOS = JSON.parse(document.getElementById('conteudos').textContent);
  var app = document.getElementById('app');
  var FOCO = 15 * 60, PAUSA = 5 * 60, DIA = 864e5;

  function load(k, d) { try { var v = localStorage.getItem('mt.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } }
  function save(k, v) { try { localStorage.setItem('mt.' + k, JSON.stringify(v)); } catch (e) {} }

  // Matéria de exemplo: a que já tem conteúdo estudado com o Claude.
  var SEED = [
    { id: 'pvw', nome: 'Programação Visual para Web', aulas: 8, conteudos: { 1: 'historia-do-html', 2: 'evolucao-do-html' }, tipo: 'Prova', data: '2026-10-02', ok: '', de: '', min: 15 },
    { id: 'ux', nome: 'Interface e UX', aulas: 8, conteudos: {}, tipo: 'Recuperação', data: '', ok: 1, de: 10, min: 15 }
  ];

  var S = {
    screen: 'home',
    sessions: load('sessions', 0),
    settings: load('settings', { big: false, autoRead: false, calm: false, guided: true }),
    materias: load('materias', SEED),
    res: load('resultados', {}),
    matId: null, aula: null, cont: null,
    plan: [], idx: 0, revealed: 1, wrong: [], lastWrong: [], ok: 0, total: 0, q: null, sv: null, del: false,
    timer: { left: FOCO, running: false, mode: 'foco' },
    sheet: null, toast: null
  };
  // Matérias que já cadastramos juntos sempre aparecem, com as aulas que já estão no app.
  SEED.forEach(function (sd) {
    var m = S.materias.filter(function (x) { return x.id === sd.id; })[0];
    if (!m) S.materias.push(sd);
    else {
      Object.keys(sd.conteudos).forEach(function (n) { m.conteudos[n] = sd.conteudos[n]; });
      if (sd.data && !m.data) m.data = sd.data;
    }
  });
  function isSeed(id) { return SEED.some(function (sd) { return sd.id === id; }); }

  var esc = function (s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var LETTERS = 'abcd';
  var ICON = {
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>',
    sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    chev: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>'
  };

  // ---------- matérias e aulas ----------
  var STATUS = { vazia: 'Não estudada', pronta: 'Pronta', estudada: 'Revisar', dominada: 'Dominada' };
  function mat(id) { return S.materias.filter(function (m) { return m.id === id; })[0]; }
  function aulaStatus(m, n) {
    var cid = m.conteudos[n];
    if (!cid || !CONTEUDOS[cid]) return 'vazia';
    var r = S.res[cid];
    if (!r) return 'pronta';
    return r.ok / r.total >= 0.8 ? 'dominada' : 'estudada';
  }
  function coverage(m) {
    var c = { vazia: 0, pronta: 0, estudada: 0, dominada: 0 };
    for (var n = 1; n <= m.aulas; n++) c[aulaStatus(m, n)]++;
    c.noApp = m.aulas - c.vazia;
    return c;
  }
  function nextAula(m) {
    var order = ['pronta', 'estudada'];
    for (var o = 0; o < order.length; o++) for (var n = 1; n <= m.aulas; n++) if (aulaStatus(m, n) === order[o]) return n;
    return null;
  }
  function firstMissing(m) { for (var n = 1; n <= m.aulas; n++) if (aulaStatus(m, n) === 'vazia') return n; return null; }
  function daysLeft(m) {
    if (!m.data) return null;
    var t = new Date(); t.setHours(0, 0, 0, 0);
    var d = new Date(m.data + 'T00:00:00');
    return Math.round((d - t) / DIA);
  }
  function fmtDate(iso) { var p = iso.split('-'); return p[2] + '/' + p[1]; }
  function urgent() {
    var withDate = S.materias.filter(function (m) { var d = daysLeft(m); return d != null && d >= 0; });
    withDate.sort(function (a, b) { return daysLeft(a) - daysLeft(b); });
    return withDate[0] || S.materias[0];
  }
  function ritmo(m) {
    var d = daysLeft(m), c = coverage(m), falta = m.aulas - c.dominada;
    if (d == null || d < 0 || !falta) return '';
    if (d === 0) return 'É hoje. Revise o que já está no app.';
    var porDia = falta / d;
    return porDia >= 1 ? 'Ritmo necessário: ' + Math.ceil(porDia) + (Math.ceil(porDia) === 1 ? ' aula por dia.' : ' aulas por dia.')
                       : 'Ritmo necessário: 1 aula a cada ' + Math.floor(1 / porDia) + ' dias.';
  }

  function plantSVG(stage) {
    stage = Math.max(0, Math.min(6, stage));
    var top = 104 - (14 + stage * 13);
    var s = '<svg viewBox="0 0 120 150" aria-hidden="true">';
    s += '<path d="M60 104 L60 ' + top + '" stroke="var(--leaf)" stroke-width="4" stroke-linecap="round" fill="none"/>';
    for (var i = 0; i < stage + 1; i++) {
      var y = 100 - i * 13 - 8, left = i % 2 === 0;
      if (y < top + 4) break;
      s += '<ellipse cx="' + (left ? 47 : 73) + '" cy="' + y + '" rx="13" ry="6" fill="var(--leaf)" transform="rotate(' + (left ? 28 : -28) + ' ' + (left ? 47 : 73) + ' ' + y + ')"/>';
    }
    s += stage >= 5 ? '<circle cx="60" cy="' + (top - 4) + '" r="9" fill="var(--hl)" stroke="var(--warn)" stroke-width="2"/>' : '<ellipse cx="60" cy="' + (top - 3) + '" rx="6" ry="8" fill="var(--leaf)"/>';
    s += '<path d="M34 104 H86 L80 140 Q79 144 75 144 H45 Q41 144 40 140 Z" fill="var(--accent)"/><rect x="30" y="100" width="60" height="10" rx="4" fill="var(--accent)"/>';
    return s + '</svg>';
  }

  function speak(text) {
    try {
      if (!('speechSynthesis' in window)) throw 0;
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(text);
      u.lang = 'pt-BR'; u.rate = 0.95;
      speechSynthesis.speak(u);
    } catch (e) { showToast('A voz não está disponível neste navegador. No app, ela usa a voz do Android.'); }
  }
  function showToast(t) { S.toast = t; render(); clearTimeout(showToast.h); showToast.h = setTimeout(function () { S.toast = null; render(); }, 3200); }

  // ---------- sessão ----------
  function startSession(matId, n) {
    var m = mat(matId), C = CONTEUDOS[m.conteudos[n]];
    S.matId = matId; S.aula = n; S.cont = C;
    S.plan = [];
    C.partes.forEach(function (_, i) {
      S.plan.push({ t: 'part', p: i });
      C.questoes.forEach(function (q, j) { if (q.parte === i) S.plan.push({ t: 'q', q: j, why: 'Pergunta rápida' }); });
    });
    var treino = C.questoes.map(function (q, j) { return j; }).filter(function (j) { return C.questoes[j].parte == null; });
    treino.sort(function (a, b) { return C.questoes[a].nivel - C.questoes[b].nivel; });
    if (treino.length) {
      S.plan.push({ t: 'intro' });
      treino.forEach(function (q) { S.plan.push({ t: 'q', q: q, why: 'Treino de interpretação' }); });
    }
    S.idx = 0; S.revealed = 1; S.wrong = []; S.lastWrong = []; S.ok = 0; S.total = 0;
    S.timer = { left: FOCO, running: true, mode: 'foco' };
    S.screen = 'session';
    enterStep();
  }
  function enterStep() {
    var st = S.plan[S.idx];
    S.revealed = 1;
    if (st && st.t === 'q') {
      var lvl = S.cont.questoes[st.q].nivel;
      S.q = { sel: null, marks: {}, guided: S.settings.guided && lvl >= 2 ? 0 : 1, text: '' };
    }
    if (st && st.t === 'part' && S.settings.autoRead) speak(S.cont.partes[st.p].pontos[0]);
    render();
  }
  function next() {
    S.sheet = null;
    S.idx++;
    if (S.idx >= S.plan.length && S.wrong.length) {
      S.plan.push({ t: 'revisao' });
      S.wrong.forEach(function (q) { S.plan.push({ t: 'q', q: q, why: 'Revisão', rev: true }); });
      S.wrong = [];
    }
    if (S.idx >= S.plan.length) { finish(); return; }
    enterStep();
  }
  function finish() {
    S.sessions++; save('sessions', S.sessions);
    S.res[S.cont.id] = { ok: S.ok, total: S.total, quando: new Date().toISOString().slice(0, 10) };
    save('resultados', S.res);
    S.timer.running = false;
    S.screen = 'result'; render();
  }

  function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function check(ok, dk) {
    var st = S.plan[S.idx];
    S.total++;
    if (ok) S.ok++;
    else if (!st.rev) { S.wrong.push(st.q); S.lastWrong.push(st.q); }
    S.sheet = { kind: 'feedback', ok: ok, dk: !!dk };
    render();
  }

  function askPart(text) {
    var parts = text.split(/(?<=[.?!])\s+/);
    return parts.length > 1 ? { before: parts.slice(0, -1).join(' '), ask: parts[parts.length - 1] } : { before: '', ask: text };
  }
  function kw(html) { return html.replace(/(INCORRETA|EXCETO|NÃO|NUNCA|SEMPRE|APENAS)/g, '<mark class="kw">$1</mark>'); }

  // ---------- sondagem ----------
  var SV_STEPS = 6;
  function newSurvey() { S.sv = { step: 0, nome: '', aulas: 8, tipo: '', data: '', semData: false, ok: '', de: '', semNota: false, min: 15 }; S.screen = 'survey'; render(); }
  function svValid() {
    var v = S.sv;
    switch (v.step) {
      case 0: return v.nome.trim().length >= 2;
      case 1: return v.aulas >= 1;
      case 2: return !!v.tipo && (v.semData || !!v.data);
      case 3: return v.semNota || (v.ok !== '' && v.de !== '' && +v.de > 0 && +v.ok >= 0 && +v.ok <= +v.de);
      default: return true;
    }
  }
  function createMateria() {
    var v = S.sv, id = 'm' + Date.now().toString(36);
    S.materias.push({ id: id, nome: v.nome.trim(), aulas: v.aulas, conteudos: {}, tipo: v.tipo, data: v.semData ? '' : v.data, ok: v.semNota ? '' : +v.ok, de: v.semNota ? '' : +v.de, min: v.min });
    save('materias', S.materias);
    S.sv = null; S.matId = id; S.screen = 'materia'; render();
  }

  // ---------- telas ----------
  function bar() {
    var t = S.timer, pct = t.left / (t.mode === 'foco' ? FOCO : PAUSA);
    var mm = String(Math.floor(t.left / 60)).padStart(2, '0') + ':' + String(t.left % 60).padStart(2, '0');
    var left = S.screen === 'home' ? '<span class="brand"><mark>Marca</mark>-Texto</span>'
      : S.screen === 'session' || S.screen === 'listen' ? '<button class="text-btn" data-a="leave">Sair</button>'
      : '<button class="text-btn" data-a="home">Início</button>';
    var timer = S.screen !== 'session' ? '' :
      '<button class="timer ' + (t.mode === 'pausa' ? 'pause' : '') + '" data-a="timer" aria-label="Cronômetro: ' + mm + (t.running ? ', toque para pausar' : ', toque para continuar') + '">' +
      '<svg viewBox="0 0 36 36"><circle class="track" cx="18" cy="18" r="15" fill="none" stroke-width="4"/><circle class="fill" cx="18" cy="18" r="15" fill="none" stroke-width="4" stroke-linecap="round" stroke-dasharray="94.25" stroke-dashoffset="' + (94.25 * (1 - pct)).toFixed(2) + '"/></svg>' +
      '<span>' + mm + '<small>' + (t.mode === 'foco' ? (t.running ? 'foco' : 'pausado') : 'pausa') + '</small></span></button>';
    return '<div class="bar"><div class="bar-left">' + left + '</div>' + timer +
      '<button class="icon-btn" data-a="settings" aria-label="Ajustes de leitura">' + ICON.gear + '</button></div>';
  }

  function steps() {
    return '<div class="steps" aria-label="Progresso da sessão">' + S.plan.map(function (_, i) {
      return '<span class="' + (i < S.idx ? 'done' : i === S.idx ? 'now' : '') + '"></span>';
    }).join('') + '</div>';
  }
  function coverBar(m) {
    var s = '<div class="cover-bar" aria-hidden="true">';
    for (var n = 1; n <= m.aulas; n++) s += '<span class="' + aulaStatus(m, n) + '"></span>';
    return s + '</div>';
  }
  function countdown(m) {
    var d = daysLeft(m);
    if (d == null) return '<span class="chip">Sem data</span>';
    if (d < 0) return '<span class="chip">Já passou</span>';
    return '<span class="chip ' + (d <= 7 ? 'lvl3' : 'lvl1') + '">' + (d === 0 ? 'Hoje' : d === 1 ? 'Amanhã' : d + ' dias') + '</span>';
  }

  function home() {
    var h = new Date().getHours();
    var hi = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    var m = urgent(), html = '<div class="screen"><div><span class="eyebrow">' + hi + '</span><h2 class="title">Bora 15 minutos?</h2></div>';
    if (m) {
      var c = coverage(m), n = nextAula(m), d = daysLeft(m);
      html += '<div class="card hero"><span class="eyebrow">' + (d != null && d >= 0 ? esc(m.tipo) + ' ' + (d === 0 ? 'hoje' : 'em ' + d + (d === 1 ? ' dia' : ' dias')) : 'Foco agora') + '</span>' +
        '<h3>' + esc(m.nome) + '</h3>' +
        '<div class="meta"><span class="pill">' + c.noApp + ' de ' + m.aulas + ' aulas no app</span><span class="pill">' + c.dominada + ' dominadas</span></div>' +
        (n ? '<button class="btn" data-a="study" data-id="' + m.id + '" data-n="' + n + '">Estudar Aula ' + n + ' ' + ICON.arrow + '</button>'
           : '<button class="btn" data-a="mat" data-id="' + m.id + '">Ver aulas que faltam ' + ICON.arrow + '</button>') + '</div>';
    }
    html += '<div class="card plant-card">' + plantSVG(S.sessions) + '<div><h4>Sua planta</h4><p>' +
      (S.sessions ? S.sessions + (S.sessions === 1 ? ' sessão concluída.' : ' sessões concluídas.') : 'Cada sessão concluída faz ela crescer.') +
      '</p><div class="streak">' + [0, 1, 2, 3, 4, 5, 6].map(function (i) { return '<span class="' + (i < S.sessions ? 'on' : '') + '"></span>'; }).join('') + '</div></div></div>';
    html += '<div class="subjects"><h4>Matérias</h4>' + S.materias.map(function (m) {
      var c = coverage(m);
      return '<button class="subject" data-a="mat" data-id="' + m.id + '"><span class="tag">' + c.noApp + '/' + m.aulas + '</span><div>' + esc(m.nome) + '<small>' + (c.vazia ? c.vazia + (c.vazia === 1 ? ' aula fora do app' : ' aulas fora do app') : 'Todas as aulas no app') + '</small></div>' + countdown(m) + '</button>';
    }).join('') +
      '<button class="subject add" data-a="survey"><span class="tag">+</span><div>Cadastrar matéria<small>Responda 5 perguntas rápidas</small></div><span class="chev">' + ICON.chev + '</span></button></div></div>';
    return html;
  }

  function materiaScreen() {
    var m = mat(S.matId), c = coverage(m), d = daysLeft(m), n = nextAula(m), miss = firstMissing(m);
    var html = '<div class="screen"><div><span class="eyebrow">Matéria</span><h2 class="title">' + esc(m.nome) + '</h2></div>';
    html += '<div class="card count-card">' +
      (d != null && d >= 0
        ? '<div class="countdown"><span class="num">' + d + '</span><span>' + (d === 1 ? 'dia' : 'dias') + ' para a ' + esc(m.tipo.toLowerCase()) + ' · ' + fmtDate(m.data) + '</span></div>'
        : '<div class="countdown"><span>' + (d != null ? 'A data cadastrada já passou.' : 'Data da ' + esc((m.tipo || 'prova').toLowerCase()) + ' não informada.') + '</span></div>') +
      '<div class="cover">' + coverBar(m) + '<span class="muted" style="font-size:13px">' + c.noApp + ' de ' + m.aulas + ' aulas no app · ' + c.dominada + ' dominadas</span></div>' +
      (ritmo(m) ? '<span style="font-size:14px;font-weight:500">' + ritmo(m) + '</span>' : '') + '</div>';
    if (c.vazia) html += '<div class="alert"><b>' + c.vazia + (c.vazia === 1 ? ' aula fora do app' : ' aulas fora do app') + '</b><span>Aula fora do app conta como não estudada. Próximo passo: mande o material da <b>Aula ' + miss + '</b> para o Claude.</span></div>';
    if (m.de && m.ok / m.de < 0.6) html += '<div class="tip"><b>Última avaliação: ' + m.ok + ' de ' + m.de + '</b><span>Mande a prova corrigida para o Claude. As questões que você errou viram o primeiro treino.</span></div>';
    html += '<div class="aulas">';
    for (var a = 1; a <= m.aulas; a++) {
      var st = aulaStatus(m, a), C = CONTEUDOS[m.conteudos[a]];
      var inner = '<span class="n">' + a + '</span><div>' + (C ? esc(C.assunto) : 'Aula ' + a) + '<small>' + (C ? (S.res[C.id] ? 'Último resultado: ' + S.res[C.id].ok + ' de ' + S.res[C.id].total : C.partes.length + ' partes · ' + C.questoes.length + ' questões') : 'Falta o material') + '</small></div><span class="status ' + st + '">' + STATUS[st] + '</span>';
      html += st === 'vazia' ? '<div class="aula vazia">' + inner + '</div>' : '<button class="aula" data-a="study" data-id="' + m.id + '" data-n="' + a + '">' + inner + '</button>';
    }
    html += '</div>';
    if (!isSeed(m.id)) html += '<button class="text-btn danger" data-a="delmat">' + (S.del ? 'Toque de novo para remover a matéria' : 'Remover matéria') + '</button>';
    html += '</div><div class="foot' + (n ? ' row' : '') + '">' + (n ? '<button class="btn ghost small" data-a="listen" data-id="' + m.id + '" data-n="' + n + '">' + ICON.sound + ' Ouvir</button><button class="btn primary" data-a="study" data-id="' + m.id + '" data-n="' + n + '">Estudar Aula ' + n + ' ' + ICON.arrow + '</button>'
      : '<button class="btn primary" disabled>Nenhuma aula pronta ainda</button>') + '</div>';
    return html;
  }

  function surveyScreen() {
    var v = S.sv, body = '', q = '', help = '';
    switch (v.step) {
      case 0:
        q = 'Qual é a matéria?'; help = 'Use o nome que aparece no portal da faculdade.';
        body = '<input class="field" id="sv-nome" autocomplete="off" placeholder="Ex.: Interface e UX" value="' + esc(v.nome) + '">';
        break;
      case 1:
        q = 'Quantas aulas ela tem?'; help = 'O app só considera a matéria estudada quando todas estiverem dentro dele.';
        body = '<div class="stepper"><button data-a="sv-minus" aria-label="Menos uma aula">−</button><output id="sv-aulas" aria-live="polite">' + v.aulas + '</output><button data-a="sv-plus" aria-label="Mais uma aula">+</button></div>';
        break;
      case 2:
        q = 'Qual é a próxima avaliação?'; help = 'Com a data, o app calcula quantas aulas você precisa estudar por dia.';
        body = '<div class="choice-grid">' + ['Prova', 'Recuperação', 'Trabalho', 'Exame final'].map(function (t) {
          return '<button class="choice' + (v.tipo === t ? ' sel' : '') + '" data-a="sv-tipo" data-v="' + t + '">' + t + '</button>';
        }).join('') + '</div>' +
          '<label class="lbl" for="sv-data">Data</label><input class="field" type="date" id="sv-data" value="' + esc(v.data) + '"' + (v.semData ? ' disabled' : '') + '>' +
          '<button class="choice wide' + (v.semData ? ' sel' : '') + '" data-a="sv-semdata">Ainda não sei a data</button>';
        break;
      case 3:
        q = 'Como foi a última avaliação?'; help = 'Sem julgamento. Serve para o app saber por onde começar.';
        body = '<div class="two"><input class="field num" type="number" inputmode="numeric" min="0" id="sv-ok" placeholder="Acertos" value="' + esc(v.ok) + '"' + (v.semNota ? ' disabled' : '') + '><span class="muted">de</span><input class="field num" type="number" inputmode="numeric" min="1" id="sv-de" placeholder="Questões" value="' + esc(v.de) + '"' + (v.semNota ? ' disabled' : '') + '></div>' +
          '<button class="choice wide' + (v.semNota ? ' sel' : '') + '" data-a="sv-semnota">Ainda não fiz nenhuma</button>';
        break;
      case 4:
        q = 'Quanto tempo por dia você consegue?'; help = 'Melhor pouco todo dia do que muito de vez em quando.';
        body = '<div class="choice-grid">' + [15, 30, 45, 60].map(function (n) {
          return '<button class="choice' + (v.min === n ? ' sel' : '') + '" data-a="sv-min" data-v="' + n + '">' + n + ' min<small>' + (n / 15) + (n === 15 ? ' bloco' : ' blocos') + ' de foco</small></button>';
        }).join('') + '</div>';
        break;
      case 5:
        q = 'Confere?';
        var rows = [['Matéria', esc(v.nome)], ['Aulas', v.aulas], ['Avaliação', esc(v.tipo) + (v.semData ? ', sem data' : ', ' + fmtDate(v.data))], ['Última nota', v.semNota ? 'Ainda não fez' : v.ok + ' de ' + v.de], ['Por dia', v.min + ' min']];
        body = '<dl class="summary">' + rows.map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'; }).join('') + '</dl>' +
          '<div class="tip"><b>A regra do app</b><span>Cada uma das ' + v.aulas + ' aulas precisa entrar no app. Aula fora dele conta como não estudada.</span></div>';
        break;
    }
    var dots = '<div class="steps">' + Array.apply(null, Array(SV_STEPS)).map(function (_, i) { return '<span class="' + (i < v.step ? 'done' : i === v.step ? 'now' : '') + '"></span>'; }).join('') + '</div>';
    return '<div class="screen">' + dots + '<div><span class="eyebrow">Sondagem · ' + (v.step + 1) + ' de ' + SV_STEPS + '</span><h2 class="title">' + q + '</h2>' + (help ? '<p class="muted" style="margin:6px 0 0">' + help + '</p>' : '') + '</div>' + body + '</div>' +
      '<div class="foot row"><button class="btn ghost small" data-a="sv-back">Voltar</button>' +
      (v.step === SV_STEPS - 1 ? '<button class="btn primary" data-a="sv-create">Criar matéria</button>'
        : '<button class="btn primary" id="sv-next" data-a="sv-next"' + (svValid() ? '' : ' disabled') + '>Próximo ' + ICON.arrow + '</button>') + '</div>';
  }

  function partScreen(st) {
    var P = S.cont.partes[st.p], n = P.pontos.length, done = S.revealed >= n;
    var items = P.pontos.slice(0, S.revealed).map(function (pt, i) {
      return '<li class="' + (i === S.revealed - 1 ? 'new' : 'old') + '"><span>' + esc(pt) + '</span></li>';
    }).join('');
    return '<div class="screen">' + steps() +
      '<div><span class="eyebrow">Aula ' + S.aula + ' · parte ' + (st.p + 1) + ' de ' + S.cont.partes.length + ' · ponto ' + S.revealed + ' de ' + n + '</span><h2 class="title">' + esc(P.titulo) + '</h2></div>' +
      '<ol class="points">' + items + '</ol>' +
      (done ? '<div class="tip"><b>Dica para lembrar</b><span>' + esc(P.dica) + '</span></div>' : '') +
      '</div><div class="foot row"><button class="btn ghost small" data-a="read" aria-label="Ouvir">' + ICON.sound + ' Ouvir</button>' +
      (done ? '<button class="btn primary" data-a="next">' + (S.plan[S.idx + 1] && S.plan[S.idx + 1].t === 'q' ? 'Pergunta rápida' : 'Continuar') + ' ' + ICON.arrow + '</button>'
            : '<button class="btn primary" data-a="reveal">Próximo ponto</button>') + '</div>';
  }

  function introScreen(title, text, btn) {
    return '<div class="screen">' + steps() +
      '<div class="card" style="display:grid;gap:12px;margin-top:12px"><span class="eyebrow">Agora</span><h2 class="title">' + title + '</h2><p style="margin:0">' + text + '</p></div>' +
      '<div class="tip"><b>Como ler enunciado longo</b><span>1. Leia a última frase primeiro. 2. Grife palavras como INCORRETA e NÃO. 3. Só então leia o texto.</span></div>' +
      '</div><div class="foot"><button class="btn primary" data-a="next">' + btn + ' ' + ICON.arrow + '</button></div>';
  }

  function questionScreen(st) {
    var Q = S.cont.questoes[st.q], q = S.q;
    var lvlName = ['', 'curta', 'média', 'longa'][Q.nivel];
    var head = '<div class="qhead"><span class="chip">' + st.why + '</span><span class="chip lvl' + Q.nivel + '">Nível ' + Q.nivel + ' · ' + lvlName + '</span></div>';
    var sp = askPart(Q.enunciado);

    if (q.guided === 0) {
      return '<div class="screen">' + steps() + head +
        '<div class="guide"><span class="step">Passo 1 de 2 · leia só a pergunta</span>' +
        '<div class="ask-only"><mark>' + kw(esc(sp.ask)) + '</mark></div>' +
        '<span class="muted" style="font-size:13.5px">Guarde isso na cabeça. É só isso que você precisa achar no texto.</span></div>' +
        '</div><div class="foot"><button class="btn primary" data-a="guide">Agora ler o texto inteiro ' + ICON.arrow + '</button></div>';
    }

    var text = '<p class="q-text">' + (sp.before ? kw(esc(sp.before)) + ' ' : '') + '<span class="ask">' + kw(esc(sp.ask)) + '</span></p>';
    var ans = '', footBtn = '';
    var inc = /INCORRETA/.test(Q.enunciado);
    if (Q.tipo === 'multipla') {
      ans = '<div class="alts">' + Q.alternativas.map(function (a, i) {
        var marks = inc ? '<div class="vf-mini"><span>Marque:</span><button data-a="mark" data-i="' + i + '" data-v="V" class="v ' + (q.marks[i] === 'V' ? 'on' : '') + '" aria-label="Alternativa ' + LETTERS[i] + ' verdadeira">V</button><button data-a="mark" data-i="' + i + '" data-v="F" class="f ' + (q.marks[i] === 'F' ? 'on' : '') + '" aria-label="Alternativa ' + LETTERS[i] + ' falsa">F</button></div>' : '';
        return '<div class="alt-wrap"><button class="alt' + (q.sel === i ? ' sel' : '') + '" data-a="sel" data-i="' + i + '"><span class="letter">' + LETTERS[i] + '</span><span>' + esc(a) + '</span></button>' + marks + '</div>';
      }).join('') + '</div>';
      footBtn = '<button class="btn primary" data-a="confirm"' + (q.sel == null ? ' disabled' : '') + '>Confirmar</button>';
    } else if (Q.tipo === 'vf') {
      ans = '<div class="vf"><button class="btn ghost" data-a="vf" data-v="verdadeiro">Verdadeiro</button><button class="btn ghost" data-a="vf" data-v="falso">Falso</button></div>';
      footBtn = '<button class="btn ghost" data-a="dontknow">Não sei</button>';
    } else {
      ans = '<input class="field" id="answer" autocomplete="off" placeholder="Sua resposta" value="' + esc(q.text) + '">';
      footBtn = '<div style="display:grid;grid-template-columns:auto 1fr;gap:10px"><button class="btn ghost small" data-a="dontknow">Não sei</button><button class="btn primary" data-a="open">Responder</button></div>';
    }
    var hint = inc && Q.nivel >= 2 ? '<div class="tip"><b>Pede a INCORRETA</b><span>Marque V ou F em cada uma. A resposta é a que ficar com F.</span></div>' : '';
    return '<div class="screen">' + steps() + head + text + hint + ans + '</div><div class="foot">' + footBtn + '</div>';
  }

  // ---------- modo ouvir ----------
  // Lê a aula inteira em sequência. Nas perguntas, espera alguns segundos antes de falar a resposta.
  var PAUSA_PERGUNTA = 6000;
  function listenItems(C, n) {
    var it = [{ k: 'Aula ' + n, t: 'Aula ' + n + ': ' + C.assunto + '.' }];
    C.partes.forEach(function (P, i) {
      it.push({ k: 'Parte ' + (i + 1), t: 'Parte ' + (i + 1) + ': ' + P.titulo + '.' });
      P.pontos.forEach(function (pt) { it.push({ k: P.titulo, t: pt }); });
      it.push({ k: 'Dica', t: 'Dica para lembrar: ' + P.dica });
      C.questoes.forEach(function (Q) { if (Q.parte === i) pushQ(it, Q); });
    });
    var resto = C.questoes.filter(function (Q) { return Q.parte == null; });
    if (resto.length) { it.push({ k: 'Treino', t: 'Agora, perguntas de treino. Pense na resposta antes de eu falar.' }); resto.forEach(function (Q) { pushQ(it, Q); }); }
    it.push({ k: 'Fim', t: 'Fim da aula ' + n + '. Quando puder, faça a sessão no app para treinar as respostas.' });
    return it;
  }
  function pushQ(it, Q) {
    var t = 'Pergunta: ' + Q.enunciado.replace(/[<>]/g, ' ');
    if (Q.tipo === 'multipla') t += ' ' + Q.alternativas.map(function (a, i) { return 'Letra ' + LETTERS[i] + ': ' + a.replace(/[<>]/g, ' '); }).join(' ');
    it.push({ k: 'Pergunta', t: t, wait: PAUSA_PERGUNTA });
    var r = Q.tipo === 'multipla' ? 'letra ' + LETTERS[Q.correta] + ', ' + Q.alternativas[Q.correta] : Q.resposta;
    it.push({ k: 'Resposta', t: 'Resposta: ' + String(r).replace(/[<>]/g, ' ') + '. ' + Q.explicacao.replace(/[<>]/g, ' ') });
  }
  function startListen(matId, n) {
    var m = mat(matId);
    S.matId = matId; S.aula = n; S.cont = CONTEUDOS[m.conteudos[n]];
    S.lp = { items: listenItems(S.cont, n), i: 0, playing: false, token: 0 };
    go('listen');
  }
  function lpStop() { S.lp.token++; clearTimeout(S.lp.h); try { speechSynthesis.cancel(); } catch (e) {} }
  function lpPlay() {
    var lp = S.lp;
    lpStop();
    if (!('speechSynthesis' in window)) { showToast('A voz não está disponível neste navegador. No app, ela usa a voz do Android.'); return; }
    lp.playing = true; render();
    var tok = lp.token, item = lp.items[lp.i];
    var u = new SpeechSynthesisUtterance(item.t);
    u.lang = 'pt-BR'; u.rate = 0.95;
    u.onend = function () {
      if (tok !== lp.token) return;
      lp.h = setTimeout(function () {
        if (tok !== lp.token) return;
        if (lp.i < lp.items.length - 1) { lp.i++; lpPlay(); } else { lp.playing = false; render(); }
      }, item.wait || 500);
    };
    speechSynthesis.speak(u);
  }
  function lpPause() { lpStop(); S.lp.playing = false; render(); }
  function listenScreen() {
    var lp = S.lp, item = lp.items[lp.i], m = mat(S.matId);
    var aulas = []; for (var a = 1; a <= m.aulas; a++) if (aulaStatus(m, a) !== 'vazia') aulas.push(a);
    var pos = aulas.indexOf(S.aula);
    var pct = Math.round((lp.i + 1) / lp.items.length * 100);
    return '<div class="screen listen">' +
      '<div><span class="eyebrow">Modo ouvir · ' + esc(m.nome) + '</span><h2 class="title">Aula ' + S.aula + ': ' + esc(S.cont.assunto) + '</h2></div>' +
      '<div class="lp-bar" role="progressbar" aria-valuenow="' + pct + '" aria-valuemin="0" aria-valuemax="100"><span style="width:' + pct + '%"></span></div>' +
      '<div class="card lp-now"><span class="chip' + (item.k === 'Pergunta' ? ' lvl3' : item.k === 'Resposta' ? ' lvl1' : '') + '">' + esc(item.k) + '</span><p>' + esc(item.t) + '</p>' +
      (item.wait && lp.playing ? '<span class="muted" style="font-size:13px">Depois da pergunta, eu espero ' + (item.wait / 1000) + ' segundos para você pensar.</span>' : '') + '</div>' +
      '<div class="lp-ctrl">' +
      '<button class="icon-btn lg" data-a="lp-prev" aria-label="Voltar um trecho"' + (lp.i === 0 ? ' disabled' : '') + '><svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h2v14H6zM20 5v14L9 12z"/></svg></button>' +
      '<button class="lp-play" data-a="' + (lp.playing ? 'lp-pause' : 'lp-play') + '" aria-label="' + (lp.playing ? 'Pausar' : 'Tocar') + '">' + (lp.playing ? '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>' : '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z"/></svg>') + '</button>' +
      '<button class="icon-btn lg" data-a="lp-next" aria-label="Pular trecho"' + (lp.i === lp.items.length - 1 ? ' disabled' : '') + '><svg viewBox="0 0 24 24" fill="currentColor"><path d="M16 5h2v14h-2zM4 5v14l11-7z"/></svg></button>' +
      '</div>' +
      '<p class="muted" style="font-size:13px;margin:0;text-align:center">Trecho ' + (lp.i + 1) + ' de ' + lp.items.length + '. Ouça nas pausas, com a moto parada.</p>' +
      '</div><div class="foot row">' +
      '<button class="btn ghost small" data-a="lp-aula" data-n="' + (aulas[pos - 1] || '') + '"' + (pos > 0 ? '' : ' disabled') + '>Aula anterior</button>' +
      '<button class="btn ghost" data-a="lp-aula" data-n="' + (aulas[pos + 1] || '') + '"' + (pos < aulas.length - 1 ? '' : ' disabled') + '>Próxima aula ' + ICON.arrow + '</button></div>';
  }

  function result() {
    var m = mat(S.matId), st = aulaStatus(m, S.aula);
    var revisar = S.lastWrong.filter(function (v, i, a) { return a.indexOf(v) === i; });
    return '<div class="screen"><div class="score">' + plantSVG(S.sessions) +
      '<span class="eyebrow">Aula ' + S.aula + ' concluída</span><span class="big">' + S.ok + ' de ' + S.total + '</span>' +
      '<span class="status ' + st + '">' + STATUS[st] + '</span>' +
      '<span class="muted">' + (st === 'dominada' ? 'Acima de 80%. Esta aula está dominada.' : 'Abaixo de 80%. Ela volta para revisão.') + '</span></div>' +
      (revisar.length ? '<div><h4 style="margin:0 0 8px;font-size:15px">Para olhar de novo amanhã</h4><ul class="review-list">' +
        revisar.map(function (q) { var e = S.cont.questoes[q].enunciado; return '<li>' + esc(e.length > 90 ? askPart(e).ask : e) + '</li>'; }).join('') + '</ul></div>' : '') +
      '</div><div class="foot"><button class="btn primary" data-a="mat" data-id="' + m.id + '">Ver a matéria</button></div>';
  }

  function sheet() {
    if (!S.sheet) return '';
    if (S.sheet.kind === 'settings') {
      var o = S.settings;
      var sw = function (k, t, d) { return '<label class="setting"><span>' + t + '<small>' + d + '</small></span><span class="switch"><input type="checkbox" id="set-' + k + '" data-set="' + k + '"' + (o[k] ? ' checked' : '') + '><span></span></span></label>'; };
      return '<div class="scrim" data-a="close"><div class="sheet" role="dialog" aria-label="Ajustes">' +
        '<h3>Ajustes</h3>' +
        sw('big', 'Texto grande', 'Aumenta as letras em 15%') +
        sw('guided', 'Leitura guiada', 'Questões longas mostram a pergunta primeiro') +
        sw('autoRead', 'Ler em voz alta', 'Lê cada ponto novo automaticamente') +
        sw('calm', 'Sem animações', 'Nada se mexe na tela') +
        '<button class="btn primary" data-a="close">Pronto</button></div></div>';
    }
    var st = S.plan[S.idx], Q = S.cont.questoes[st.q], ok = S.sheet.ok;
    var right = Q.tipo === 'multipla' ? LETTERS[Q.correta] + ') ' + Q.alternativas[Q.correta] : Q.resposta;
    return '<div class="scrim"><div class="sheet ' + (ok ? 'ok' : 'no') + '" role="dialog" aria-live="polite">' +
      '<h3>' + (ok ? 'Acertou!' : S.sheet.dk ? 'Tudo bem, é para isso que treinamos' : 'Quase!') + '</h3>' +
      '<div class="answer-line">Resposta: ' + esc(right) + '</div>' +
      '<p style="margin:0">' + esc(Q.explicacao) + '</p>' +
      (!ok && Q.dica_leitura ? '<div class="tip"><b>Dica de leitura</b><span>' + esc(Q.dica_leitura) + '</span></div>' : '') +
      (!ok && !st.rev ? '<span class="muted" style="font-size:13px">Essa pergunta volta no fim da sessão.</span>' : '') +
      '<button class="btn primary" data-a="next">Continuar ' + ICON.arrow + '</button></div></div>';
  }

  function render() {
    app.className = 'app' + (S.settings.big ? ' big' : '') + (S.settings.calm ? ' calm' : '');
    var html = bar();
    if (S.screen === 'home') html += home();
    else if (S.screen === 'materia') html += materiaScreen();
    else if (S.screen === 'survey') html += surveyScreen();
    else if (S.screen === 'result') html += result();
    else if (S.screen === 'listen') html += listenScreen();
    else {
      var st = S.plan[S.idx];
      if (st.t === 'part') html += partScreen(st);
      else if (st.t === 'intro') html += introScreen('Treino de interpretação', 'Agora as questões ficam maiores, do nível 1 ao 3. Use a leitura guiada.', 'Começar treino');
      else if (st.t === 'revisao') html += introScreen('Revisão rápida', 'As perguntas que você errou voltam uma vez. Sem pressa.', 'Revisar');
      else html += questionScreen(st);
    }
    html += sheet();
    if (S.toast) html += '<div class="toast" role="status">' + esc(S.toast) + '</div>';
    var focusId = document.activeElement && app.contains(document.activeElement) && document.activeElement.id;
    app.innerHTML = html;
    if (focusId) { var f = document.getElementById(focusId); if (f) { f.focus(); try { f.setSelectionRange(f.value.length, f.value.length); } catch (e) {} } }
  }
  function go(screen) { if (S.lp && screen !== 'listen') { lpStop(); S.lp = null; } S.screen = screen; S.sheet = null; S.del = false; render(); }

  // ---------- interações ----------
  app.addEventListener('click', function (e) {
    var b = e.target.closest('[data-a]');
    if (!b || !app.contains(b) || b.disabled) return;
    var a = b.getAttribute('data-a');
    if (a === 'close' && e.target !== b && b.classList.contains('scrim')) return;
    var st = S.plan[S.idx], v = S.sv;
    switch (a) {
      case 'home': S.timer.running = false; go('home'); break;
      case 'leave': S.timer.running = false; go('materia'); break;
      case 'mat': S.matId = b.getAttribute('data-id'); go('materia'); break;
      case 'listen': startListen(b.getAttribute('data-id'), +b.getAttribute('data-n')); break;
      case 'lp-play': lpPlay(); break;
      case 'lp-pause': lpPause(); break;
      case 'lp-prev': S.lp.i = Math.max(0, S.lp.i - 1); S.lp.playing ? lpPlay() : render(); break;
      case 'lp-next': S.lp.i = Math.min(S.lp.items.length - 1, S.lp.i + 1); S.lp.playing ? lpPlay() : render(); break;
      case 'lp-aula': startListen(S.matId, +b.getAttribute('data-n')); break;
      case 'study': startSession(b.getAttribute('data-id'), +b.getAttribute('data-n')); break;
      case 'survey': newSurvey(); break;
      case 'delmat':
        if (!S.del) { S.del = true; render(); break; }
        S.materias = S.materias.filter(function (m) { return m.id !== S.matId; }); save('materias', S.materias); go('home'); break;
      case 'settings': S.sheet = { kind: 'settings' }; render(); break;
      case 'close': S.sheet = null; render(); break;
      case 'timer': S.timer.running = !S.timer.running; render(); break;
      case 'reveal':
        S.revealed++; render();
        if (S.settings.autoRead) speak(S.cont.partes[st.p].pontos[S.revealed - 1]);
        break;
      case 'read':
        var P = S.cont.partes[st.p];
        speak(S.revealed >= P.pontos.length ? P.pontos[S.revealed - 1] + '. Dica: ' + P.dica : P.pontos[S.revealed - 1]);
        break;
      case 'next': next(); break;
      case 'guide': S.q.guided = 1; render(); break;
      case 'sel': S.q.sel = +b.getAttribute('data-i'); render(); break;
      case 'mark':
        var i = +b.getAttribute('data-i'), mv = b.getAttribute('data-v');
        S.q.marks[i] = S.q.marks[i] === mv ? null : mv; render(); break;
      case 'confirm': if (S.q.sel != null) check(S.q.sel === S.cont.questoes[st.q].correta); break;
      case 'vf': check(b.getAttribute('data-v') === S.cont.questoes[st.q].resposta); break;
      case 'dontknow': check(false, true); break;
      case 'open':
        var r = norm(S.cont.questoes[st.q].resposta), x = norm(S.q.text);
        if (!x) { showToast('Escreva uma resposta ou toque em "Não sei".'); break; }
        check(x === r || (x.length >= 3 && (r.indexOf(x) >= 0 || x.indexOf(r) >= 0)));
        break;
      // sondagem
      case 'sv-next': if (svValid()) { v.step++; render(); } break;
      case 'sv-back': if (v.step === 0) { S.sv = null; go('home'); } else { v.step--; render(); } break;
      case 'sv-minus': v.aulas = Math.max(1, v.aulas - 1); render(); break;
      case 'sv-plus': v.aulas = Math.min(40, v.aulas + 1); render(); break;
      case 'sv-tipo': v.tipo = b.getAttribute('data-v'); render(); break;
      case 'sv-semdata': v.semData = !v.semData; render(); break;
      case 'sv-semnota': v.semNota = !v.semNota; render(); break;
      case 'sv-min': v.min = +b.getAttribute('data-v'); render(); break;
      case 'sv-create': createMateria(); break;
    }
  });
  app.addEventListener('input', function (e) {
    var id = e.target.id, v = S.sv;
    if (id === 'answer') S.q.text = e.target.value;
    else if (v && id === 'sv-nome') v.nome = e.target.value;
    else if (v && id === 'sv-data') v.data = e.target.value;
    else if (v && id === 'sv-ok') v.ok = e.target.value;
    else if (v && id === 'sv-de') v.de = e.target.value;
    else return;
    var nb = document.getElementById('sv-next');
    if (nb) nb.disabled = !svValid();
  });
  app.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter') return;
    var t = e.target.id === 'answer' ? '[data-a="open"]' : /^sv-/.test(e.target.id) ? '#sv-next' : null;
    var b = t && app.querySelector(t);
    if (b && !b.disabled) b.click();
  });
  app.addEventListener('change', function (e) {
    var k = e.target.getAttribute('data-set');
    if (!k) return;
    S.settings[k] = e.target.checked; save('settings', S.settings); render();
  });

  setInterval(function () {
    var t = S.timer;
    if (!t.running || S.screen !== 'session') return;
    t.left--;
    if (t.left <= 0) {
      if (t.mode === 'foco') { t.mode = 'pausa'; t.left = PAUSA; showToast('15 minutos de foco! Pausa de 5: levanta, bebe água.'); return; }
      t.mode = 'foco'; t.left = FOCO; showToast('Pausa acabou. Mais 15 minutos?');
      return;
    }
    var fill = app.querySelector('.timer .fill'), lbl = app.querySelector('.timer > span');
    if (fill && lbl) {
      fill.setAttribute('stroke-dashoffset', (94.25 * (1 - t.left / (t.mode === 'foco' ? FOCO : PAUSA))).toFixed(2));
      lbl.firstChild.nodeValue = String(Math.floor(t.left / 60)).padStart(2, '0') + ':' + String(t.left % 60).padStart(2, '0');
    }
  }, 1000);

  render();
})();
