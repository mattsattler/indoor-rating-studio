/* Offline local persistence, portable JSON backups, and round-trip CSV exports. */
(function (global) {
  'use strict';
  const E = global.RatingEngine;
  const KEY = 'indoor-rating-studio:local:v1';
  const TYPE = 'indoor-rating-studio-backup';
  const TODAY = () => { const now = new Date(); return [now.getFullYear(), String(now.getMonth()+1).padStart(2,'0'), String(now.getDate()).padStart(2,'0')].join('-'); };
  const uniqueId = () => (global.crypto && typeof global.crypto.randomUUID === 'function') ? global.crypto.randomUUID() : `match-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
  const text = (v, max=160) => String(v == null ? '' : v).slice(0,max).trim();
  const safeDate = v => /^\d{4}-\d{2}-\d{2}$/.test(String(v)) && !Number.isNaN(Date.parse(String(v))) ? String(v) : TODAY();
  function normalizeMatch(item) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('An imported match is not a valid object.');
    if (!item.stats || typeof item.stats !== 'object') throw new Error('An imported match is missing its event statistics.');
    const match = {
      id: text(item.id, 120) || uniqueId(), player: text(item.player, 90) || 'Unnamed player',
      team: text(item.team, 90), opponent: text(item.opponent, 90), date: safeDate(item.date),
      position: ['forward','midfielder','defender','keeper','mixed'].includes(item.position) ? item.position : 'midfielder',
      positionShares: E.cleanPositionShares(item.positionShares),
      minutes: Math.max(0, Math.min(50, Number(item.minutes) || 0)),
      result: ['win','draw','loss','none'].includes(item.result) ? item.result : 'none',
      stats: E.cleanStats(item.stats), weights: E.cleanWeights(item.weights || E.defaultWeights()),
      createdAt: text(item.createdAt,40) || new Date().toISOString(),
      updatedAt: text(item.updatedAt,40) || new Date().toISOString()
    };
    if (match.position === 'mixed' && E.positionShareTotal(match.positionShares) !== 100) {
      throw new Error('Mixed-position allocation must total 100%.');
    }
    match.rating = E.calculate(match.stats, match.position, match.weights, match.positionShares).rating;
    return match;
  }
  // Settings created by the early outdoor-weight app can remain in the browser's
  // localStorage after replacing application files. Migrate ONLY matching legacy
  // default values, leaving independent customizations and stored match reports alone.
  function migrateLegacyDefaultWeights(input) {
    const current = E.cleanWeights(input || E.defaultWeights());
    const baseline = E.defaultWeights();
    const factor = E.CALIBRATION.weightMultiplier;
    const legacyShooting = Object.freeze({
      goals: [1.10, 1.15], shotsOn: [0.12], shotsOff: [-0.035],
      bigMisses: [-0.36]
    });
    const matches = (actual, expected, tolerance=0.0008) => Math.abs(actual-expected) <= tolerance;
    const comparable = E.EVENTS.filter(event => !Object.prototype.hasOwnProperty.call(legacyShooting,event.key) &&
      event.key!=='shotBlocked' && event.key!=='exceptionalMiss');
    const legacyMatching = comparable.filter(event => matches(current[event.key],baseline[event.key]/factor)).length;
    const looksLegacy = legacyShooting.goals.some(v => matches(current.goals, v, 0.015)) &&
      legacyMatching >= Math.ceil(comparable.length * 0.65);
    if (!looksLegacy) return { weights: current, changed: 0 };
    let changed=0;
    for (const event of E.EVENTS) {
      const key=event.key;
      if (Object.prototype.hasOwnProperty.call(legacyShooting,key)) {
        if (!legacyShooting[key].some(v=>matches(current[key],v,0.0008))) continue;
      } else if(key==='shotBlocked'||key==='exceptionalMiss' ||
          !matches(current[key],baseline[key]/factor)) continue;
      if (!matches(current[key],baseline[key],0.000001)) {
        current[key]=baseline[key];changed++;
      }
    }
    return { weights: current, changed };
  }
  function emptyState() { return { matches: [], draft: null, weights: E.defaultWeights() }; }
  function load() {
    const blank = emptyState();
    try {
      const raw = global.localStorage.getItem(KEY);
      if (!raw) return { state: blank, available: true };
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') throw new Error('Stored file is invalid');
      const matches = Array.isArray(parsed.matches) ? parsed.matches.map(normalizeMatch) : [];
      const migrated = migrateLegacyDefaultWeights(parsed.weights || blank.weights);
      return { state: { matches, draft: parsed.draft || null, weights: migrated.weights }, available: true, migratedWeights: migrated.changed };
    } catch (error) {
      return { state: blank, available: false, reason: error.message };
    }
  }
  function save(state) {
    try { global.localStorage.setItem(KEY, JSON.stringify(state)); return true; }
    catch (_) { return false; }
  }
  function exportBackup(state) {
    return { type: TYPE, version: 1, exportedAt: new Date().toISOString(), format: 'Indoor Rating Studio',
      matches: state.matches.map(normalizeMatch), weights: E.cleanWeights(state.weights) };
  }
  function safeCell(v) {
    let content = String(v == null ? '' : v);
    // Protect text fields from spreadsheet formula execution on CSV opening.
    if (/^[\s]*[=+@\-]/.test(content) && !/^\s*-?\d+(\.\d+)?\s*$/.test(content)) content = "'"+content;
    return '"' + content.replace(/"/g, '""') + '"';
  }
  function csvTable(rows) { return '\uFEFF' + rows.map(row => row.map(safeCell).join(',')).join('\r\n'); }
  function exportLibraryCSV(matches) {
    const meta = ['id','player','team','opponent','date','position','minutes','result','rating','createdAt','updatedAt'];
    const shareKeys=E.POSITION_KEYS.map(k=>'positionShare:'+k);
    const eventKeys = E.EVENTS.map(ev => ev.key);
    const weightKeys = eventKeys.map(key => 'weight:'+key);
    const metricKeys = ['passCompletionPct','dribbleCompletionPct','shotAccuracyPct','totalPossessionLost','passAttempts','dribbleAttempts','shotAttempts','shotsOnTarget','shotsOffTarget'];
    const cols = [...meta,...shareKeys,...metricKeys,...eventKeys,...weightKeys];
    const rows = [cols];
    matches.forEach(item => {
      const m = normalizeMatch(item);
      const r = E.calculate(m.stats, m.position, m.weights, m.positionShares);
      rows.push([...meta.map(k => m[k]), ...E.POSITION_KEYS.map(k => m.position === 'mixed' ? m.positionShares[k] : ''), r.passAccuracy??'', r.dribbleAccuracy??'', r.shotAccuracy??'', r.totalPossessionLost, r.passAttempts, r.dribbleAttempts, r.shotAttempts, r.shotsOnTarget, r.shotsOffTarget, ...eventKeys.map(k => m.stats[k]), ...eventKeys.map(k => m.weights[k])]);
    });
    return csvTable(rows);
  }
  function exportReportCSV(match) {
    const m = normalizeMatch(match);
    const result = E.calculate(m.stats, m.position, m.weights, m.positionShares);
    const rows = [['Indoor Rating Studio','Match report'],['Player',m.player],['Team',m.team],['Opponent',m.opponent],['Date',m.date],['Position',m.position],['Position allocation',m.position==='mixed'?E.POSITION_KEYS.filter(k=>m.positionShares[k]>0).map(k=>`${k}: ${m.positionShares[k]}%`).join(' / '):'Single position'],['Minutes',m.minutes],['Result',m.result],['Match rating',result.rating],['Pass completion (%)',result.passAccuracy===null?'':result.passAccuracy],['Passes completed',m.stats.passGood],['Pass attempts',result.passAttempts],['Shot accuracy (%)',result.shotAccuracy===null?'':result.shotAccuracy],['Total shots',result.shotAttempts],['Shots on target',result.shotsOnTarget],['Shots off target',result.shotsOffTarget],['Dribble completion (%)',result.dribbleAccuracy===null?'':result.dribbleAccuracy],['Dribbles completed',m.stats.dribbleWon],['Dribble attempts',result.dribbleAttempts],['Total possession lost',result.totalPossessionLost],[],['Category','Event','Count','Base weight','Position multiplier','Rating impact']];
    E.GROUPS.forEach(group => {
      const factor = result.factors[group.id];
      group.events.forEach(([key,label]) => rows.push([group.title,label,m.stats[key],m.weights[key],factor,Number(result.impact[key].toFixed(4))]));
      rows.push([group.title+' subtotal','','','','',Number(result.groups.find(g=>g.id===group.id).subtotal.toFixed(4))]);
    });
    rows.push(['Total event impact','','','','',Number(result.net.toFixed(4))]);
    rows.push(['Final rating','','','','',result.rating]);
    return csvTable(rows);
  }
  // RFC-4180 style parser: quoted commas, escaped quotes and multiline quoted fields.
  function parseCSV(input) {
    const value = String(input).replace(/^\uFEFF/,'');
    let rows=[], row=[], field='', quoted=false;
    for(let i=0;i<value.length;i++) {
      const ch = value[i];
      if(ch==='"') { if(quoted && value[i+1]==='"') { field+='"'; i++; } else quoted=!quoted; }
      else if(ch===',' && !quoted) {row.push(field); field='';}
      else if((ch==='\n'||ch==='\r') && !quoted) {if(ch==='\r' && value[i+1]==='\n')i++; row.push(field); rows.push(row); row=[];field='';}
      else field+=ch;
    }
    if(quoted) throw new Error('CSV contains an unclosed quoted field.');
    if(field!==''||row.length){row.push(field);rows.push(row);}
    return rows.filter(r=>r.some(x=>x.trim()!==''));
  }
  function importData(raw, filename='') {
    const isCSV = /\.csv$/i.test(filename) || (!String(raw).trimStart().startsWith('{') && !String(raw).trimStart().startsWith('['));
    if (isCSV) {
      const data = parseCSV(raw);
      if (data.length < 2) throw new Error('The CSV needs a header and at least one match.');
      const headings = data[0].map(v=>v.trim());
      if (!headings.includes('player') || !E.EVENTS.some(ev=>headings.includes(ev.key))) throw new Error('This CSV is not a Studio library export. Import a full library CSV or JSON backup.');
      const matches = data.slice(1).map(line=>{
        const obj = Object.fromEntries(headings.map((key,i)=>[key,line[i] ?? '']));
        const stats=Object.fromEntries(E.EVENTS.map(ev=>[ev.key,obj[ev.key] || 0]));
        const weights=Object.fromEntries(E.EVENTS.map(ev=>[ev.key,obj['weight:'+ev.key] === '' || obj['weight:'+ev.key] === undefined ? ev.weight : obj['weight:'+ev.key]]));
        const shares=Object.fromEntries(E.POSITION_KEYS.map(k=>[k,obj['positionShare:'+k]]));
        const hasShareColumns=E.POSITION_KEYS.some(k=>headings.includes('positionShare:'+k));
        return normalizeMatch({...obj, stats, weights, positionShares:hasShareColumns?shares:undefined});
      });
      return { matches, weights: null, source: 'CSV library' };
    }
    let parsed;
    try {parsed = JSON.parse(String(raw));} catch (_) {throw new Error('The selected file is not valid JSON.');}
    if (Array.isArray(parsed)) parsed = { matches: parsed };
    if (!parsed || typeof parsed !== 'object') throw new Error('This JSON file is not a valid Studio backup.');
    const items = Array.isArray(parsed.matches) ? parsed.matches : (parsed.match ? [parsed.match] : (parsed.stats ? [parsed] : null));
    if (!items) throw new Error('No matches were found in this JSON file.');
    if (items.length > 20000) throw new Error('This backup contains too many matches.');
    return { matches: items.map(normalizeMatch), weights: parsed.weights ? migrateLegacyDefaultWeights(parsed.weights).weights : null, source: 'JSON backup' };
  }
  function download(filename, data, mime) {
    const blob = new Blob([data],{type:mime});
    const uri = URL.createObjectURL(blob);
    const anchor = document.createElement('a');anchor.href=uri;anchor.download=filename;
    document.body.appendChild(anchor);anchor.click();anchor.remove();
    setTimeout(()=>URL.revokeObjectURL(uri),1500);
  }
  global.RatingStorage = Object.freeze({ KEY, TYPE, uniqueId, TODAY, normalizeMatch, emptyState, migrateLegacyDefaultWeights, load, save, exportBackup, exportLibraryCSV, exportReportCSV, importData, download });
})(window);
