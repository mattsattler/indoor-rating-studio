/* Indoor Rating Studio — self-contained browser application, no build step. */
(function () {
  'use strict';
  const E = window.RatingEngine;
  const S = window.RatingStorage;
  const $ = id => document.getElementById(id);
  const q = (selector, root=document) => root.querySelector(selector);
  const loaded = S.load();
  const state = loaded.state;
  const today = S.TODAY();
  Object.assign(state,S.normalizeSeasonState(state));
  const escapeHTML = s => String(s == null ? '' : s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const nfmt = (value, digits=2) => (value >= 0 ? '+' : '') + Number(value).toFixed(digits);
  const pct = value => Math.min(100,Math.max(0,value));
  const text = (v, max=90) => String(v||'').slice(0,max);
  let activeGroup='attack';
  let reportMatch=null;
  let storageWarningShown=false;
  let toastTimeout=null;
  let currentView='studio';
  let advancedPassingOpen=false;
  function freshDraft(last) {
    return { id:null, seasonId:state.activeSeasonId, player:(last && last.player)||'Zava', team:(last && last.team)||'Northland Nomads', opponent:'', date:today,
      position:(last && last.position)||'midfielder', positionShares:E.cleanPositionShares(last && last.positionShares), minutes:25, result:'none', stats:E.defaultStats() };
  }
  if (!state.draft || typeof state.draft!=='object') state.draft = freshDraft();
  state.draft = { ...freshDraft(), ...state.draft, positionShares:E.cleanPositionShares(state.draft.positionShares), stats:E.cleanStats(state.draft.stats) };
  state.draft.seasonId=state.matches.find(m=>m.id===state.draft.id)?.seasonId || (S.validSeason(state.draft.seasonId)&&state.seasons.some(item=>item.id===state.draft.seasonId)?state.draft.seasonId:state.activeSeasonId);
  state.weights = E.cleanWeights(state.weights);
  const fields=['player','team','opponent','date','position','minutes','result'];

  function notify(message, isError=false) {
    const toast=$('toast');toast.textContent=message;toast.classList.toggle('error',isError);toast.hidden=false;
    clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>{toast.hidden=true;},4900);
  }
  function persist() {
    const okay = S.save(state);
    const label=$('saveState');
    label.textContent=okay?'● Locally saved':'● Backup recommended';
    label.style.color=okay?'#83d4bb':'#ffaf9c';
    $('storageIndicator').textContent=okay?'Browser storage available':'Browser storage unavailable';
    $('storageIndicator').classList.toggle('warn',!okay);
    if(!okay && !storageWarningShown) {storageWarningShown=true;notify('This browser may not allow local-file storage. Export JSON to avoid losing your records.',true);}
  }
  function hydrateFields() {
    fields.forEach(id=>{const input=$(id);if(input)input.value=state.draft[id] ?? '';});
    $('minutes').value=state.draft.minutes;
    renderSeasonControls();
    $('matchSeason').value=state.draft.seasonId;
    $('date').value=state.draft.date;
    E.POSITION_KEYS.forEach(k=>{$('split-'+k).value=state.draft.positionShares[k];});
    renderPositionSplit();
    $('editingNotice').textContent=state.draft.id?'Editing saved performance • Save to update':'New unsaved performance';
  }
  function readFields() {
    fields.forEach(id=>{let val=$(id).value; if(id==='minutes')val=Math.max(0,Math.min(50,Number(val)||0));state.draft[id]=val;});
    state.draft.seasonId=S.validSeason($('matchSeason').value)||state.activeSeasonId;
    if(!['forward','midfielder','defender','keeper','mixed'].includes(state.draft.position))state.draft.position='midfielder';
    if(!['win','draw','loss','none'].includes(state.draft.result))state.draft.result='none';
  }
  function formatPosition(position, shares){
    if(position!=='mixed')return position.charAt(0).toUpperCase()+position.slice(1);
    const split=E.cleanPositionShares(shares);
    const names={forward:'FWD',midfielder:'MID',defender:'DEF',keeper:'GK'};
    const parts=E.POSITION_KEYS.filter(k=>split[k]>0).map(k=>`${names[k]} ${split[k]}%`);
    return 'Mixed' + (parts.length ? ' · '+parts.join(' / ') : '');
  }
  function renderPositionSplit(){
    const mixed=state.draft.position==='mixed';
    $('mixedPositionPanel').hidden=!mixed;
    if(!mixed)return;
    const shares=E.cleanPositionShares(state.draft.positionShares);
    const sum=E.positionShareTotal(shares);
    $('mixedPositionTotal').textContent=sum+'% allocated';
    $('mixedPositionTotal').classList.toggle('invalid',sum!==100);
    $('mixedPositionPanel').classList.toggle('invalid',sum!==100);
    const names={forward:'Forward',midfielder:'Midfielder',defender:'Defender',keeper:'Goalkeeper'};
    E.POSITION_KEYS.forEach(k=>{$('splitBar-'+k).style.width=(sum>0 ? shares[k]/sum*100 : 0)+'%';});
    const minutes=Number(state.draft.minutes)||0;
    const segments=E.POSITION_KEYS.filter(k=>shares[k]>0).map(k=>`${names[k]} ${shares[k]}% (${(minutes*shares[k]/100).toFixed(1)} min)`);
    $('mixedPositionSummary').textContent=sum===100?(segments.join(' · ')||'Assign time to a position'):'Allocate exactly 100% before saving. Live rating is provisional.';
  }
  function validPositionSplit(){
    if(state.draft.position!=='mixed')return true;
    if(E.positionShareTotal(state.draft.positionShares)===100)return true;
    showView('studio');
    $('split-forward').focus();
    notify('Mixed positions must add up to exactly 100% before saving or generating a report.',true);
    return false;
  }
  function renderTabs() {
    $('eventTabs').innerHTML=E.GROUPS.map(g=>`<button type="button" role="tab" aria-selected="${g.id===activeGroup}" data-tab="${g.id}" class="event-tab ${g.id===activeGroup?'selected':''}" style="--tone:${g.tint}"><span class="event-tab-dot"></span>${escapeHTML(g.short)}</button>`).join('');
  }
  function eventRow(key,label,hint,group) {
    const val=state.draft.stats[key];const weight=state.weights[key];
    const impact=val*weight*E.positionFactors(state.draft.position,state.draft.positionShares)[E.BY_KEY[key].factorGroup];
    return `<div class="event-item" title="${escapeHTML(hint)}"><div class="event-label"><strong>${escapeHTML(label)}</strong><small>${weight>=0?'+':''}${weight.toFixed(3)} / event${val ? ` · ${nfmt(impact)} impact` : ''}</small></div><div class="counter"><button type="button" aria-label="Subtract ${escapeHTML(label)}" data-minus="${key}">−</button><input type="number" min="0" max="99999" step="1" inputmode="numeric" aria-label="${escapeHTML(label)} count" data-count="${key}" value="${val}"><button type="button" class="plus" aria-label="Add ${escapeHTML(label)}" data-plus="${key}">+</button></div></div>`;
  }
  function renderEvents() {
    const group=E.GROUPS.find(g=>g.id===activeGroup);
    $('groupTitle').textContent=group.title;
    $('groupSubtitle').textContent=group.description;
    if (activeGroup==='possession') {
      // Preserve all passing subtypes and place dribbles + turnovers in Possession.
      // Passing subtypes stay collapsed, exactly as in the previous release.
      const countRows=keys=>keys.map(key=>{
        const event=E.BY_KEY[key];return eventRow(event.key,event.label,event.hint,group);
      }).join('');
      $('eventGrid').innerHTML=
        `<div class="event-subhead">PASSING</div>` + countRows(['passGood','passBad','keyPass','longGood']) +
        `<details id="extraPassing" class="extra-events" ${advancedPassingOpen?'open':''}><summary>Additional passing events <span>Through balls &amp; crosses</span></summary><div class="extra-events-grid">${countRows(['through','crossGood'])}</div></details>` +
        `<div class="event-subhead">DRIBBLING</div>` + countRows(['dribbleWon','dribbleLost']) +
        `<div class="event-subhead">BALL CONTROL</div>` + countRows(['posLost','badTouch']);
    } else {
      $('eventGrid').innerHTML=group.events.map(([key,label,weight,hint])=>eventRow(key,label,hint,group)).join('');
    }
    renderTabs();
    renderEfficiency();
  }
  function renderEfficiency(result) {
    const r=result||calculate();
    const el=$('completionPanel');
    // Accuracy and success meters now live in the top dashboard, not a duplicated panel below Attack / Passing.
    if(activeGroup==='possession') {
      el.innerHTML=`<div class="efficiency-heading"><strong>POSSESSION LOST</strong><span>Automatically calculated</span></div><div class="turnover-total"><strong>${r.totalPossessionLost}</strong><span>TOTAL TURNOVERS</span></div><p class="efficiency-note">${r.stats.passBad} inaccurate passes + ${r.stats.dribbleLost} failed dribbles + ${r.stats.badTouch} unsuccessful touches + ${r.stats.posLost} dispossessions. This total is informational, not an extra penalty.</p>`;
    } else el.innerHTML='';
  }
  function refreshEventDescriptions() {
    const group=E.GROUPS.find(g=>g.id===activeGroup);
    for(const [key] of group.events){
      const row=q(`[data-count="${key}"]`);
      if (!row) continue;
      const impact=state.draft.stats[key]*state.weights[key]*E.positionFactors(state.draft.position,state.draft.positionShares)[E.BY_KEY[key].factorGroup];
      row.closest('.event-item').querySelector('small').textContent=`${state.weights[key]>=0?'+':''}${state.weights[key].toFixed(3)} / event${state.draft.stats[key] ? ` · ${nfmt(impact)} impact` : ''}`;
    }
  }
  function calculate() { return E.calculate(state.draft.stats,state.draft.position,state.weights,state.draft.positionShares); }
  function renderLive() {
    const r=calculate();
    const minutes=Math.max(0,Math.min(50,Number(state.draft.minutes)||0));
    const ratio=pct((r.rawRating-3)/7*100);
    $('ratingDial').style.setProperty('--angle',ratio+'%');
    $('ratingNumber').textContent=r.rating.toFixed(1);
    $('ratingGrade').textContent=r.grade.toUpperCase();
    $('ratingProgressFill').style.width=ratio+'%';
    $('ratingChange').textContent=nfmt(r.net)+' event points';
    $('heroName').innerHTML='<span class="hero-overline">PLAYER PERFORMANCE</span><br>'+escapeHTML(state.draft.player||'Unnamed player');
    $('heroPosition').textContent=state.draft.position==='mixed'?'MIXED POSITIONS':state.draft.position.toUpperCase();
    renderPositionSplit();
    $('heroOpponent').textContent=state.draft.opponent ? `VS ${state.draft.opponent.toUpperCase()}`:'ADD YOUR OPPONENT';
    $('minuteLabel').textContent=`${minutes} of 50 minutes (${Math.round(minutes*2)}%)`;
    $('minuteFill').style.width=(minutes*2)+'%';
    $('kpiGA').textContent=r.goalContributions;
    $('kpiGADetail').textContent=`${r.stats.goals} goals · ${r.stats.assists} assists`;
    $('kpiPass').textContent=r.passAccuracy===null?'—':r.passAccuracy+'%';
    $('kpiPassDetail').textContent=r.passAccuracy===null?'No passes logged':`${r.stats.passGood} / ${r.passAttempts} passes completed`;
    $('kpiShot').textContent=r.shotAccuracy===null?'—':r.shotAccuracy+'%';
    $('kpiShotDetail').textContent=r.shotAccuracy===null?'No shots logged':`${r.shotsOnTarget} / ${r.shotAttempts} shots on target`;
    $('kpiDribble').textContent=r.dribbleAccuracy===null?'—':r.dribbleAccuracy+'%';
    $('kpiDribbleDetail').textContent=r.dribbleAccuracy===null?'No dribbles logged':`${r.stats.dribbleWon} / ${r.dribbleAttempts} dribbles completed`;
    $('kpiPassFill').style.width=(r.passAccuracy===null?0:r.passAccuracy)+'%';
    $('kpiShotFill').style.width=(r.shotAccuracy===null?0:r.shotAccuracy)+'%';
    $('kpiDribbleFill').style.width=(r.dribbleAccuracy===null?0:r.dribbleAccuracy)+'%';
    $('kpiLost').textContent=r.totalPossessionLost;
    $('kpiLostDetail').textContent='From recorded turnovers';
    $('netImpact').textContent=nfmt(r.net);
    $('sideRating').textContent=r.rating.toFixed(1);
    $('breakdownRows').innerHTML=r.groups.map(group=>`<div><div class="breakdown-title"><span>${escapeHTML(group.title)}</span><strong class="${group.subtotal<0?'negative':''}">${nfmt(group.subtotal)}</strong></div><div class="breakdown-track"><span style="background:${group.subtotal<0?'#ed8291':group.tint};width:${Math.min(100,Math.abs(group.subtotal)/2*100)}%"></span></div></div>`).join('');
    const group=r.groups.find(g=>g.id===activeGroup);
    $('groupTotal').innerHTML=`${nfmt(group.subtotal)} <span>PTS</span>`;
    $('groupTotal').classList.toggle('negative',group.subtotal<0);
    refreshEventDescriptions();
    renderEfficiency(r);
  }
  function renderWeights() {
    $('weightList').innerHTML=E.GROUPS.map(g=>`<div class="weight-category" style="--tone:${g.tint}"><span></span>${escapeHTML(g.title)}</div>${g.events.map(([key,label])=>`<div class="weight-row"><label for="weight-${key}">${escapeHTML(label)}</label><input class="weight-input" id="weight-${key}" data-weight="${key}" type="number" min="-10" max="10" step="0.005" value="${state.weights[key]}"></div>`).join('')}`).join('');
  }
  // Concrete definitions and operational tracking rules. Exactly one entry per engine event.
  // Glossary is UI-only; changing descriptions must never mutate event weights or saved data.
  const EVENT_GUIDE = {
    goals: ['A legal goal scored by this player into the opposing net.', 'Count once when credited as the scorer. A saved shot or off-target shot cannot also be a goal.', 'Goal is itself one on-target attempt; do not add another shooting outcome.'],
    assists: ['The final credited attacking pass to a teammate who scores.', 'Count when the teammate scores directly following the player’s intentional pass, consistent with your league’s assist rule.', 'Do not count a chance that was not converted, or an earlier pass in the sequence.'],
    shotsOn: ['An attempted shot on goal prevented by the opposing goalkeeper.', 'Count a direct attempt that was on target and saved; exclude goals.', 'A shot stopped by an outfield defender belongs under Shots blocked (attempts), not here.'],
    shotsOff: ['A regular shot attempt that misses the goal.', 'Count missed shots that are not classified as a clear or exceptional missed chance.', 'A keeper save, goal or defender block is a different shot outcome.'],
    shotBlocked: ['An attacking shot attempt stopped by an opposing outfield defender.', 'Count once when your shot is blocked before reaching the goal.', 'This is not a defensive block made by your player; do not also log as an off-target shot.'],
    bigChances: ['A clear, high-probability scoring opportunity created for a teammate.', 'Count when this player’s deliberate action puts a teammate in an unusually favorable position to score, whether or not they shoot.', 'It may also qualify as a key pass if the teammate takes a shot; that overlap is intentional.'],
    bigMisses: ['A clear, high-quality goal opportunity that the player sends off target.', 'Use for an obvious missed scoring chance, such as an uncontested close-range attempt, when it goes wide or over.', 'This replaces ordinary Shots off target for that attempt. A saved attempt is Shots on target (saved).'],
    exceptionalMiss: ['An unusually clear scoring opportunity missed off target.', 'Reserve for rare near-certain chances, such as an uncontested open-net miss at very close range.', 'Use instead of both ordinary and big missed-shot categories; not in addition.'],
    dribbleWon: ['A successful one-versus-one take-on while controlling the ball.', 'Count when the player beats an opponent on the dribble and keeps possession or productively advances it.', 'Routine ball carrying in open space is not a completed dribble.'],
    dribbleLost: ['An attempted one-versus-one take-on that fails and loses possession.', 'Count when the opponent wins the ball during the player’s attempted dribble.', 'Already contributes to possession lost; do not also count Dispossessed or Unsuccessful touches.'],
    passGood: ['A deliberate pass received successfully by a teammate.', 'Count one for every completed pass, including successful key passes, crosses, through balls and long balls.', 'Counting a pass in a subtype does not create an additional pass attempt.'],
    passBad: ['A pass attempt that does not successfully reach a teammate.', 'Count intercepted, misdirected or out-of-reach passes when your player is responsible for the failed delivery.', 'Already contributes to possession lost; do not also count Dispossessed for the same mistake.'],
    keyPass: ['A completed pass that immediately sets up a teammate’s shot.', 'Count once for the final pass before a teammate attempts a shot, whether the teammate scores or misses.', 'Already included in Passes completed; it is a bonus for chance creation, not another pass attempt.'],
    longGood: ['A completed long-distance distribution pass.', 'Use a consistent team rule for “long” across matches (suggestion: intentional passes about 15 m or more). Count only those received by a teammate.', 'Already included in Passes completed; the 15 m cutoff is a Studio suggestion, not an MASL standard.'],
    through: ['A completed pass directed through or behind the defense into a teammate’s path.', 'Count only when a teammate receives the line-breaking pass.', 'It can also be a key or long pass, but remains one completed pass.'],
    crossGood: ['A successful pass played from a wide attacking area toward a teammate in the central scoring area.', 'Count when the cross reaches a teammate successfully.', 'Crosses can be key passes, but are already part of Passes completed.'],
    tackles: ['A successful challenge that stops an opponent’s controlled attack or wins the ball.', 'Count when a deliberate tackle cleanly halts possession or makes the ball available to your team.', 'Do not count an interception of a pass as a tackle unless a separate challenge occurs.'],
    tackleLost: ['An attempted tackle that fails to stop the opponent.', 'Count a genuine defensive challenge where the attacker retains possession and escapes.', 'Do not record every unsuccessful press or jockey as a failed tackle.'],
    intercepts: ['Preventing an opponent pass from reaching its intended target.', 'Count when you intentionally cut out or redirect a live opponent pass.', 'If you also secure the loose ball, a Ball recovery can be recorded as a separate follow-up action.'],
    blocks: ['A shot taken by an opponent that this player blocks.', 'Count each shot stopped by a defender before it reaches the goalkeeper or goal.', 'Not the same as your own attacking Shots blocked (attempts).'],
    clearances: ['A deliberate action that removes the ball from an immediate defensive danger area.', 'Count an intentional kick, header or other legal clearance that relieves immediate pressure.', 'Routine passes out of defense are not clearances.'],
    duelsWon: ['An individually contested challenge for control of the ball that this player wins.', 'Count a physical or technical challenge resulting in the player winning possession or the ball for their team.', 'A tackle may also be a duel won; track each duel only once, not each touch within it.'],
    duelsLost: ['An individually contested challenge for the ball that this player loses.', 'Count when an opponent prevails in a direct contested challenge.', 'Do not use for unchallenged inaccurate passes or missed shots.'],
    recoveries: ['Securing a loose ball that neither side clearly controls.', 'Count when the player gains possession of a rebound, deflection or other unpossessed ball.', 'An opponent pass intentionally cut out is an interception; count a recovery as well only if the ball becomes loose and is subsequently secured.'],
    dribbledPast: ['An opponent beats the player while actively defending a dribble.', 'Count when the defender is directly bypassed by the attacker’s controlled take-on.', 'Do not count if the opponent simply passes around the defender.'],
    posLost: ['Losing a controlled ball directly to an opponent outside a dribble attempt.', 'Count when an opponent strips or dispossesses the player who had secure control, e.g., while shielding.', 'Do not also enter the same turnover as a failed dribble, inaccurate pass or unsuccessful touch.'],
    badTouch: ['A poor first touch or ball-control mistake that causes a turnover.', 'Count when the player miscontrols an otherwise playable ball and opponents gain it.', 'Do not count a touch that the player recovers or a ball taken by a defender from established control (Dispossessed).'],
    foulsWon: ['A foul committed by the opponent against this player.', 'Count a referee-awarded foul drawn while the player is involved in the action.', 'An ordinary bump with no foul decision is not recorded.'],
    fouls: ['A foul committed by this player.', 'Count each foul called by the referee against the player.', 'If a card is also shown, record the foul and card as separate consequences.'],
    yellow: ['A yellow disciplinary card shown to this player.', 'Count the actual caution cards shown, up to the app’s two-yellow limit.', 'Do not estimate based on rough challenges alone.'],
    red: ['A red card or equivalent sending-off issued to this player.', 'Enter 1 only when the player is formally sent off.', 'If the dismissal results from a second yellow, record the actual two yellows and red consistently throughout the season.'],
    errors: ['A clear outfield-player mistake leading directly to an opponent goal.', 'Count when an identifiable preventable error directly causes the goal, not merely because the player was on the court.', 'Avoid also using this for the same own goal unless an additional separate error occurred.'],
    ownGoals: ['A goal officially credited into the player’s own net.', 'Count only when the scoring authority designates an own goal.', 'Do not count a routine defensive deflection as an own goal unless officially recorded as one.'],
    saves: ['An ordinary goalkeeper save preventing a shot on target from becoming a goal.', 'Count each opposing on-target attempt stopped by the keeper, including penalty saves.', 'Goalkeeper catches of non-shot passes belong under Successful claims, not Saves.'],
    greatSaves: ['An exceptional save judged significantly more difficult than a routine stop.', 'Count as a bonus for a standout diving, reflex or one-on-one save, in addition to its ordinary Save.', 'Use a consistent difficulty threshold; this bonus is subjective and can stack with Saves.'],
    conceded: ['A goal conceded by the team while this goalkeeper is on the court.', 'Count each opponent goal scored during this goalkeeper’s playing time.', 'Do not count goals conceded before entering or after being substituted off.'],
    cleanSheet: ['A complete goalkeeper shutout with no opposing goals allowed.', 'Enter 1 only if this goalkeeper plays the full qualifying match and no goals are conceded.', 'Partial-minute relief appearances should not receive this reward.'],
    penSaved: ['A penalty-kick attempt stopped by the goalkeeper.', 'Count each penalty shot saved during play.', 'Also count as an ordinary Save; this is an extra reward for a difficult/high-stakes stop.'],
    claims: ['A dangerous cross, lofted pass or loose ball securely gathered by the goalkeeper.', 'Count when the keeper safely captures or smothers a non-shot ball and establishes control.', 'A shot caught by the keeper is a Save, not an additional Successful claim.'],
    gkErrors: ['A clear goalkeeper mistake leading directly to an opposing goal.', 'Count preventable distribution, handling or positioning mistakes directly responsible for the goal.', 'A difficult goal conceded without an identifiable goalkeeper error is not this stat.']
  };
  function renderMethodology(){
    const positions=[['Forward','forward'],['Midfielder','midfielder'],['Defender','defender'],['Goalkeeper','keeper']];
    $('methodFactorGrid').innerHTML=`<div class="factor-grid-head"><span>POSITION</span><span>ATTACK</span><span>PASSING</span><span>DEFENSE</span><span>OTHER</span><span>KEEPER</span></div>`+positions.map(([label,pos])=>{
      const f=E.FACTORS[pos];return `<div class="factor-grid-row"><strong>${label}</strong>${['attack','passing','defense','discipline','goalkeeping'].map(k=>`<span class="${f[k]!==1?'factor-accent':''}">${f[k].toFixed(2)}×</span>`).join('')}</div>`;
    }).join('')+`<div class="factor-grid-row mixed-factor-note"><strong>Mixed positions</strong><span style="grid-column:span 5">Time-weighted average of each position’s original event multipliers; e.g. 60% forward + 40% defender.</span></div>`;
    const derived=[
      ['SHOT ACCURACY','(goals + saved/on-target shots) ÷ all six shot outcomes','Goals and saved/on-target shots count as accurate. Blocked attempts and all three missed-shot categories count in the denominator. This is not goal conversion.','#ff7d89'],
      ['PASS COMPLETION','completed passes ÷ (completed + inaccurate passes)','Key, long, through and cross categories are subsets of completed passes; they do not increase total attempts.','#9585ff'],
      ['DRIBBLE COMPLETION','completed dribbles ÷ (completed + unsuccessful dribbles)','A dispossession outside a take-on does not count as an unsuccessful dribble.','#34dabb'],
      ['POSSESSION LOST','inaccurate passes + unsuccessful dribbles + unsuccessful touches + dispossessed','A derived count for reporting only; it carries no second rating penalty.','#ffd16f'],
      ['GOAL CONTRIBUTIONS','goals + assists','This sum counts direct scoring involvement. Goals and assists each separately affect the rating.','#64b7ff'],
      ['DUEL SUCCESS','duels won ÷ (duels won + duels lost)','Calculated for reports when duel attempts are recorded. No attempts means no rate rather than 0%.','#e6a7fa']
    ];
    $('methodDerived').innerHTML=derived.map(([title,formula,detail,tone])=>`<article class="derived-card" style="--tone:${tone}"><span>${title}</span><strong>${formula}</strong><p>${detail}</p></article>`).join('');
    const search=$('methodSearch').value.trim().toLowerCase();
    const priorOpen=new Set([...$('methodGroups').querySelectorAll('details[open][data-method-group]')].map(x=>x.dataset.methodGroup));
    let matched=0;
    $('methodGroups').innerHTML=E.GROUPS.map((g,i)=>{
      const events=g.events.filter(([key,label])=>{
        const guide=EVENT_GUIDE[key];return !search||[label,...guide,g.title].join(' ').toLowerCase().includes(search);
      });
      if(!events.length)return '';
      matched+=events.length;
      const expanded=search||priorOpen.has(g.id)||(!$('methodGroups').dataset.initialized&&i===0);
      return `<details class="method-group" data-method-group="${g.id}" style="--tone:${g.tint}" ${expanded?'open':''}><summary><span class="method-group-dot"></span><div><strong>${escapeHTML(g.title)}</strong><small>${escapeHTML(g.description)}</small></div><span class="method-group-count">${events.length} EVENTS</span><span class="method-chevron">⌄</span></summary><div class="method-event-list">${events.map(([key,label])=>{
        const [definition,record,avoid]=EVENT_GUIDE[key];const w=state.weights[key];
        return `<article class="method-event"><div class="method-event-title"><strong>${escapeHTML(label)}</strong><span class="method-event-weight ${w<0?'negative':''}">${nfmt(w,3)} / event</span></div><p class="method-definition">${escapeHTML(definition)}</p><div class="method-event-details"><div><b>WHEN TO COUNT</b><p>${escapeHTML(record)}</p></div><div><b>AVOID / OVERLAP</b><p>${escapeHTML(avoid)}</p></div></div></article>`;
      }).join('')}</div></details>`;
    }).join('')||'<div class="method-empty">No matching statistics. Try a different keyword.</div>';
    $('methodGroups').dataset.initialized='true';
    $('methodMatches').textContent=matched+' definition'+(matched===1?'':'s');
  }
  // Season selection changes what is displayed; it never deletes or resets saved records.
  function seasonOptions(selected){
    return state.seasons.map(season=>`<option value="${escapeHTML(season.id)}" ${season.id===selected?'selected':''}>${escapeHTML(season.name)}${season.archived?' (Archive)':''}</option>`).join('');
  }
  function renderSeasonControls(){
    document.querySelectorAll('.season-view-select').forEach(select=>{
      if(document.activeElement===select)return;
      select.innerHTML=seasonOptions(state.viewSeasonId);
    });
    document.querySelectorAll('.season-view-note').forEach(el=>{
      el.textContent=state.viewSeasonId===state.activeSeasonId?'Active season · New statistics':'Archived season · Historical statistics';
    });
    const match=$('matchSeason');
    if(match && document.activeElement!==match){match.innerHTML=seasonOptions(state.draft.seasonId);match.value=state.draft.seasonId;}
  }
  function setViewSeason(id){
    if(!state.seasons.some(season=>season.id===id))return;
    state.viewSeasonId=id;
    persist();renderSeasonControls();
    if(currentView==='roster')window.RosterView.render(state.matches,id,state.manualSeasonStats,state.seasons);
    if(currentView==='library')renderLibrary();
    if(currentView==='analytics')renderAnalytics();
    if(currentView==='comparison' && window.ComparisonView)window.ComparisonView.render(state,id);
    if(currentView==='data'){renderSeasonManager();$('manualSeason').value=id;renderManualSeasonEditor();}
  }
  function renderSeasonManager(){
    const cards=$('seasonCards');
    cards.innerHTML=state.seasons.map(season=>{
      const count=state.matches.filter(m=>m.seasonId===season.id).length;
      const manual=Object.keys(state.manualSeasonStats[season.id]||{}).length;
      const current=season.id===state.activeSeasonId;
      return `<div class="season-card ${current?'season-card-active':''}"><div class="season-card-label">${current?'CURRENT SEASON':'SEASON ARCHIVE'}</div><strong>${escapeHTML(season.name)}</strong><p>${count} saved ${count===1?'match':'matches'} · ${manual} manual player ${manual===1?'entry':'entries'}</p><button type="button" class="btn btn-secondary" data-manage-view-season="${season.id}">${season.id===state.viewSeasonId?'Viewing season':'View season'}</button></div>`;
    }).join('');
  }
  function renderManualSeasonEditor(){
    const playerSelect=$('manualPlayer');
    const seasonSelect=$('manualSeason');
    if(!playerSelect.options.length){
      playerSelect.innerHTML=window.RosterView.players.map(p=>`<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)}</option>`).join('');
    }
    const prev=state.seasons.some(season=>season.id===seasonSelect.value)?seasonSelect.value:state.viewSeasonId;
    seasonSelect.innerHTML=seasonOptions(prev);
    const current=(state.manualSeasonStats[seasonSelect.value]||{})[playerSelect.value]||{};
    const inputRow=(key,label)=>`<label class="manual-stat-field"><span>${escapeHTML(label)}</span><input type="number" inputmode="numeric" min="0" max="999999" step="1" data-manual-key="${escapeHTML(key)}" value="${Object.prototype.hasOwnProperty.call(current,key)?current[key]:''}" placeholder="—"></label>`;
    $('manualSeasonFields').innerHTML=`<div class="manual-stat-core">${inputRow('appearances','Appearances')}${inputRow('minutes','Minutes played')}</div><div class="manual-stat-groups">${E.GROUPS.map((g,i)=>`<details class="manual-stat-group" ${i===0?'open':''}><summary>${escapeHTML(g.title)} <span>${g.events.length} metrics</span></summary><div class="manual-stat-grid">${g.events.map(([key,label])=>inputRow(key,label)).join('')}</div></details>`).join('')}</div>`;
    $('manualSeasonStatus').textContent=`${Object.keys(current).length} manually entered fields · blanks use saved matches`;
  }
  function saveManualSeason(){
    const season=$('manualSeason').value,player=$('manualPlayer').value;
    const values={};
    for(const input of $('manualSeasonFields').querySelectorAll('[data-manual-key]')){
      const v=input.value.trim();if(!v)continue;
      const n=Number(v);
      if(!Number.isInteger(n) || n<0 || n>999999){notify('Season statistics must be whole numbers from 0 to 999999.',true);input.focus();return;}
      values[input.dataset.manualKey]=n;
    }
    state.manualSeasonStats[season]??={};
    if(Object.keys(values).length)state.manualSeasonStats[season][player]=values;
    else delete state.manualSeasonStats[season][player];
    if(!Object.keys(state.manualSeasonStats[season]).length)delete state.manualSeasonStats[season];
    persist();renderSeasonManager();renderManualSeasonEditor();notify('Season totals saved. No match records or ratings were changed.');
  }
  function startNextSeason(){
    const old=state.activeSeasonId;
    const next=String(Number(old)+1);
    if(!S.validSeason(next)){notify('Season limit reached.',true);return;}
    const currentMatches=state.matches.filter(m=>m.seasonId===old).length;
    if(!window.confirm(`Archive ${S.seasonName(old)} (${currentMatches} saved matches) and start ${S.seasonName(next)}? Existing records and manual totals remain available. Export a backup first for extra safety.`))return;
    state.seasons=state.seasons.map(s=>({...s,archived:s.id===old?true:s.archived}));
    if(!state.seasons.some(s=>s.id===next))state.seasons.push({id:next,name:S.seasonName(next),archived:false});
    state.activeSeasonId=next;state.viewSeasonId=next;
    Object.assign(state,S.normalizeSeasonState(state));
    if(!state.draft.id && !E.EVENTS.some(ev=>state.draft.stats[ev.key]))state.draft.seasonId=next;
    hydrateFields();renderSeasonControls();renderSeasonManager();renderManualSeasonEditor();persist();
    notify(`${S.seasonName(next)} is active. Previous seasons are preserved.`);
  }
  function showView(view) {
    if(!['studio','roster','library','analytics','comparison','data','methodology'].includes(view))return;
    currentView=view;
    document.querySelectorAll('.view').forEach(el=>{el.hidden=el.id!=='view-'+view;el.classList.toggle('active',!el.hidden);});
    document.querySelectorAll('[data-view]').forEach(btn=>btn.classList.toggle('selected',btn.dataset.view===view));
    if(view==='roster' && window.RosterView)window.RosterView.render(state.matches,state.viewSeasonId,state.manualSeasonStats,state.seasons);
    if(view==='library')renderLibrary();
    if(view==='analytics')renderAnalytics();
    if(view==='comparison' && window.ComparisonView)window.ComparisonView.render(state,state.viewSeasonId);
    if(view==='data'){renderWeights();renderSeasonManager();renderManualSeasonEditor();}
    if(view==='methodology')renderMethodology();
    window.scrollTo({top:0,behavior:'instant'});
  }
  function resetEvents() {
    if(E.EVENTS.some(e=>state.draft.stats[e.key]) && !window.confirm('Clear every recorded event in this match?'))return;
    state.draft.stats=E.defaultStats();renderEvents();renderLive();persist();notify('Event counts cleared.');
  }
  function newMatch() {
    if(state.draft.stats && E.EVENTS.some(e=>state.draft.stats[e.key]) && !window.confirm('Create a new match? Export or save the current performance first if you need it.'))return;
    const last=state.draft;state.draft=freshDraft(last);hydrateFields();renderEvents();renderLive();persist();showView('studio');notify('New match ready.');
  }
  function buildMatch() {
    readFields();
    if(!validPositionSplit())return null;
    if(!state.draft.player.trim()) {showView('studio');$('player').focus();notify('Enter a player name before saving.',true);return null;}
    const old=state.matches.find(m=>m.id===state.draft.id);
    const now=new Date().toISOString();
    return S.normalizeMatch({ ...state.draft, id:state.draft.id||S.uniqueId(),
      stats:{...state.draft.stats}, weights:{...state.weights},createdAt:old?old.createdAt:now,updatedAt:now });
  }
  function saveMatch() {
    const match=buildMatch();if(!match)return;
    const index=state.matches.findIndex(item=>item.id===match.id);
    if(index>=0) state.matches[index]=match;else state.matches.unshift(match);
    state.draft.id=match.id;
    hydrateFields();persist();openReport(match);notify(index>=0?'Match updated and report ready.':'Match saved and report ready.');
  }
  function previewMatch() {
    readFields();
    if(!validPositionSplit())return;
    const match=S.normalizeMatch({...state.draft,id:state.draft.id||S.uniqueId(),weights:{...state.weights},stats:{...state.draft.stats}});
    persist();openReport(match);
  }
  function slug(str) { return String(str||'match').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,42)||'match'; }
  function reportFilename(ext) {return `${slug(reportMatch.player)}-${reportMatch.date}-rating-${reportMatch.rating}.${ext}`;}
  function openReport(input) {
    reportMatch=S.normalizeMatch(input);
    const m=reportMatch;
    const r=E.calculate(m.stats,m.position,m.weights,m.positionShares);
    const rate=v=>v===null?'—':v+'%';
    const resultLabel=m.result==='none'?'Not recorded':m.result.charAt(0).toUpperCase()+m.result.slice(1).toLowerCase();
    const brandTitle='Northland Nomads Performance Analytics';
    const summaryBlocks=`
      <div class="report-summary-card report-summary-matchup">
        <div class="report-summary-line"><span class="report-summary-label">Team</span><strong>${escapeHTML(m.team||'—')}</strong></div>
        <div class="report-summary-vs">vs</div>
        <div class="report-summary-line"><span class="report-summary-label">Opponent</span><strong>${escapeHTML(m.opponent||'—')}</strong></div>
      </div>
      <div class="report-summary-card report-summary-meta">
        <div class="report-summary-line"><span class="report-summary-label">Season</span><strong>${escapeHTML(S.seasonName(m.seasonId))}</strong></div>
        <div class="report-summary-line"><span class="report-summary-label">Match date</span><strong>${escapeHTML(m.date)}</strong></div>
        <div class="report-summary-line"><span class="report-summary-label">Minutes</span><strong>${escapeHTML(m.minutes+' / 50 min')}</strong></div>
        <div class="report-summary-line"><span class="report-summary-label">Position</span><strong>${escapeHTML(formatPosition(m.position,m.positionShares))}</strong></div>
      </div>
      <div class="report-summary-card report-summary-outcome">
        <div class="report-summary-line"><span class="report-summary-label">Result</span><strong>${escapeHTML(resultLabel)}</strong></div>
        <div class="report-summary-line"><span class="report-summary-label">Goals + Assists</span><strong>${escapeHTML(String(r.goalContributions))}</strong></div>
        <div class="report-summary-line"><span class="report-summary-label">Events tracked</span><strong>${escapeHTML(E.EVENTS.length+' Event Types')}</strong></div>
      </div>`;

    const kpiCards=`<div class="report-kpi-strip">
      <div class="report-kpi-card"><div class="report-kpi-value">${rate(r.shotAccuracy)}</div><div class="report-kpi-title">Shot Accuracy</div><div class="report-kpi-detail">(${r.shotsOnTarget} / ${r.shotAttempts})</div></div>
      <div class="report-kpi-card"><div class="report-kpi-value">${rate(r.passAccuracy)}</div><div class="report-kpi-title">Pass Completion</div><div class="report-kpi-detail">(${r.stats.passGood} / ${r.passAttempts})</div></div>
      <div class="report-kpi-card"><div class="report-kpi-value">${rate(r.dribbleAccuracy)}</div><div class="report-kpi-title">Dribble Completion</div><div class="report-kpi-detail">(${r.stats.dribbleWon} / ${r.dribbleAttempts})</div></div>
      <div class="report-kpi-card"><div class="report-kpi-value">${r.totalPossessionLost}</div><div class="report-kpi-title">Possession Lost</div><div class="report-kpi-detail">All turnover causes</div></div>
    </div>`;

    const groupCards={};
    E.GROUPS.forEach(g=>{
      const subtotal=r.groups.find(x=>x.id===g.id).subtotal;
      const rows=g.events.map(([key,label])=>{
        const impact=r.impact[key];
        return `<tr><td>${escapeHTML(label)}</td><td class="${m.stats[key]===0?'zero':''}">${m.stats[key]}</td><td>${nfmt(m.weights[key],3)}</td><td class="${impact>0?'plus':impact<0?'minus':'zero'}">${nfmt(impact,3)}</td></tr>`;
      }).join('');
      groupCards[g.id]=`<section class="report-card report-card-${g.id}"><div class="report-card-head"><div class="report-card-title">${escapeHTML(g.title)}</div><div class="report-card-total ${subtotal<0?'negative':''}">${nfmt(subtotal)} pts</div></div><table class="report-table modern"><thead><tr><th>Event</th><th>Count</th><th>Weight</th><th>Impact</th></tr></thead><tbody>${rows}</tbody></table></section>`;
    });

    const sections=`<div class="report-sections-top">${groupCards.attack||''}${groupCards.possession||''}</div><div class="report-sections-bottom">${groupCards.defense||''}${groupCards.goalkeeping||''}${groupCards.other||''}</div>`;
    const footer=`<div class="report-disclaimer">Generated report preserves the saved weights for this match. Impact = event count × event weight × position factor. Shot accuracy, pass completion, dribble completion, and possession lost are derived automatically from tracked counts.</div>`;

    $('reportBody').innerHTML=`
      <article class="report-page report-redesign">
        <div class="report-topline">
          <div class="report-topline-brand"><span class="report-topline-mark">//</span><span>${brandTitle}</span></div>
          <div class="report-topline-version">V3 Beta</div>
        </div>
        <div class="report-showcase">
          <div class="report-player-block">
            <h1>${escapeHTML(m.player)}</h1>
            <p>Full Match Performance Report</p>
          </div>
          <div class="report-rating-panel">
            <div class="report-rating-label">Final Rating</div>
            <div class="report-rating-main">${r.rating.toFixed(1)}<span>/ 10</span></div>
            <div class="report-rating-grade">${escapeHTML(r.grade.toUpperCase())}</div>
            <div class="report-rating-side"><div>6.5 Baseline</div><strong>${nfmt(r.net)} Event Pts</strong></div>
          </div>
        </div>
        <div class="report-summary-grid">${summaryBlocks}</div>
        ${kpiCards}
        ${sections}
        ${footer}
      </article>`;
    $('reportModal').hidden=false;
    document.body.style.overflow='hidden';
    $('reportBody').scrollTop=0;
    $('reportClose').focus();
  }
  function closeReport(){ $('reportModal').hidden=true; document.body.style.overflow=''; reportMatch=null; }
  function summaryHTML(label,value,detail) {return `<div class="summary-tile"><span>${label}</span><strong>${value}</strong><small>${detail}</small></div>`;}
  function avgRating(list) {return list.length?(list.reduce((t,m)=>t+m.rating,0)/list.length).toFixed(1):'—';}
  function totals() {
    const matches=matchesForSelectedSeason();
    return {matches:matches.length,goals:matches.reduce((n,m)=>n+m.stats.goals,0),assists:matches.reduce((n,m)=>n+m.stats.assists,0),minutes:matches.reduce((n,m)=>n+m.minutes,0)};
  }
  function matchesForSelectedSeason(){return state.matches.filter(m=>m.seasonId===state.viewSeasonId);}
  function dateLabel(d){const parsed=new Date(d+'T12:00:00');return Number.isNaN(parsed.getTime())?d:parsed.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});}
  function renderLibrary() {
    const t=totals();
    $('libraryStats').innerHTML=summaryHTML('TOTAL MATCHES',t.matches,'Saved performances')+summaryHTML('AVERAGE RATING',avgRating(matchesForSelectedSeason()),'Across saved matches')+summaryHTML('TOTAL GOALS',t.goals,'Recorded goals')+summaryHTML('TOTAL ASSISTS',t.assists,'Recorded assists');
    $('libraryCount').textContent=`${t.matches} matches`;
    let matches=matchesForSelectedSeason().filter(m=>`${m.player} ${m.team} ${m.opponent}`.toLowerCase().includes($('librarySearch').value.toLowerCase().trim()));
    const sort=$('librarySort').value;
    matches=[...matches].sort((a,b)=>sort==='oldest'?a.date.localeCompare(b.date):sort==='rating'?b.rating-a.rating:sort==='player'?a.player.localeCompare(b.player):b.date.localeCompare(a.date));
    $('libraryList').innerHTML=matches.length?matches.map(m=>`<div class="library-item"><div class="library-item-main"><div class="record-avatar">${escapeHTML((m.player||'P').slice(0,2).toUpperCase())}</div><div><div class="record-title">${escapeHTML(m.player)} <span style="color:#8999b4;font-weight:500">vs ${escapeHTML(m.opponent||'Unknown')}</span></div><div class="record-sub">${dateLabel(m.date)} · ${escapeHTML(formatPosition(m.position,m.positionShares))} · ${m.minutes} min · ${m.stats.goals}G ${m.stats.assists}A</div></div></div><div class="record-right"><strong class="record-rating ${m.rating<6?'low':''}">${m.rating.toFixed(1)}</strong><button class="small-btn" type="button" data-report="${escapeHTML(m.id)}">Report</button><button class="small-btn" type="button" data-edit="${escapeHTML(m.id)}">Edit</button><button class="small-btn delete" type="button" data-delete="${escapeHTML(m.id)}">Delete</button></div></div>`).join(''):`<div class="empty-state"><div class="empty-orbit">◈</div><strong>No matches found</strong><p>Save a performance in Match Studio, or import an earlier backup.</p><button class="btn btn-primary" type="button" id="emptyNewMatch">Open studio ↗</button></div>`;
    const empty=$('emptyNewMatch');if(empty)empty.addEventListener('click',()=>showView('studio'));
  }
  function effectiveSeasonTotals(){
    const games=matchesForSelectedSeason();
    const manual=state.manualSeasonStats[state.viewSeasonId]||{};
    const known=new Set();
    const result={goals:0,assists:0,minutes:0};
    window.RosterView.players.forEach(player=>{
      const key=player.id;known.add(key);
      const recorded=games.filter(game=>S.playerKey(game.player)===key);
      const overrides=manual[key]||{};
      ['goals','assists','minutes'].forEach(metric=>{
        const recordedTotal=recorded.reduce((sum,game)=>sum+(metric==='minutes'?game.minutes:Number(game.stats[metric]||0)),0);
        result[metric]+=Object.prototype.hasOwnProperty.call(overrides,metric)?overrides[metric]:recordedTotal;
      });
    });
    games.filter(game=>!known.has(S.playerKey(game.player))).forEach(game=>{
      result.goals+=Number(game.stats.goals)||0;
      result.assists+=Number(game.stats.assists)||0;
      result.minutes+=Number(game.minutes)||0;
    });
    return result;
  }
  function renderAnalytics() {
    const t=effectiveSeasonTotals();
    const all=matchesForSelectedSeason();const scored=all.filter(m=>m.rating>=7).length;
    $('analyticsKpis').innerHTML=summaryHTML('AVERAGE RATING',avgRating(all),'Recorded match ratings')+summaryHTML('HIGH-RATED GAMES',scored,'Ratings of 7.0 or higher')+summaryHTML('GOAL INVOLVEMENTS',t.goals+t.assists,`${t.goals} goals · ${t.assists} assists`)+summaryHTML('MINUTES PLAYED',t.minutes,'Including manual season totals');
    const recent=[...all].sort((a,b)=>a.date.localeCompare(b.date)).slice(-12);
    $('ratingChart').innerHTML=recent.length?recent.map(m=>{const h=pct((m.rating-3)/7*100);return `<div class="chart-col" title="${escapeHTML(m.player)} · ${m.rating.toFixed(1)} vs ${escapeHTML(m.opponent||'Unknown')}"><span class="chart-value">${m.rating.toFixed(1)}</span><div class="chart-bar ${m.rating>=7?'green':''}" style="--h:${Math.max(2,h)}%"></div><div class="chart-label">${escapeHTML(m.player.split(' ')[0])}</div></div>`;}).join(''):'<div class="empty-state"><strong>No chart data yet</strong><p>Save matches to build your rating history.</p></div>';
    const best=[...all].sort((a,b)=>b.rating-a.rating).slice(0,5);
    $('topPerformances').innerHTML=best.length?best.map(m=>`<div class="top-record"><div><strong>${escapeHTML(m.player)}</strong><small>${dateLabel(m.date)} · ${escapeHTML(m.opponent||'Unknown opponent')}</small></div><div class="top-record-score">${m.rating.toFixed(1)}</div></div>`).join(''):'<div class="empty-state"><p>Top performances will appear here.</p></div>';
  }
  function exportAllJSON(){S.download('northland-nomads-all-seasons-backup.json',JSON.stringify(S.exportBackup(state),null,2),'application/json');notify('Full JSON backup exported. Keep this file somewhere safe.');}
  function exportAllCSV(){S.download('northland-nomads-match-library-all-seasons.csv',S.exportLibraryCSV(state.matches),'text/csv;charset=utf-8');notify('Match library CSV exported across every season. For manual season totals, use the JSON backup.');}
  async function performImport(file) {
    if(!file)return;
    if(file.size>15*1024*1024){notify('This file is over 15 MB. Select a smaller backup.',true);return;}
    try{
      const parsed=S.importData(await file.text(),file.name);
      const hasManual=parsed.manualSeasonStats && Object.keys(parsed.manualSeasonStats).length>0;
      if(!parsed.matches.length && !hasManual){notify('No match or manual season records found in this file.',true);return;}
      const replace=$('importMode').value==='replace';
      if(replace && !window.confirm(`Replace ${state.matches.length} existing matches AND your manual season totals? Export your full JSON backup first. This will import ${parsed.matches.length} matches.`))return;
      if(replace){
        state.matches=parsed.matches;
        if(parsed.weights)state.weights=parsed.weights;
        state.draft.id=null;
        Object.assign(state,S.normalizeSeasonState({matches:state.matches,seasons:parsed.seasons,activeSeasonId:parsed.activeSeasonId,viewSeasonId:parsed.viewSeasonId,manualSeasonStats:parsed.manualSeasonStats}));
        state.draft.seasonId=state.activeSeasonId;
      }else{
        const byId=new Map(state.matches.map(m=>[m.id,m]));
        parsed.matches.forEach(m=>byId.set(m.id,m));state.matches=[...byId.values()];
        const seasons=[...state.seasons,...(parsed.seasons||[])];
        const manual=structuredClone(state.manualSeasonStats);
        Object.entries(parsed.manualSeasonStats||{}).forEach(([season,players])=>{
          manual[season]??={};
          Object.entries(players).forEach(([player,stats])=>{manual[season][player]={...(manual[season][player]||{}),...stats};});
        });
        Object.assign(state,S.normalizeSeasonState({...state,matches:state.matches,seasons,manualSeasonStats:manual}));
      }
      state.matches.sort((a,b)=>b.date.localeCompare(a.date));
      hydrateFields();renderEvents();renderLive();renderSeasonControls();persist();showView('library');
      notify(`Imported ${parsed.matches.length} matches and ${hasManual?'manual season totals':'season metadata'} from ${parsed.source}.`);
    }catch(error){notify('Import failed: '+error.message,true);}
    finally{$('importFile').value='';}
  }
  document.querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener('click',()=>showView(btn.dataset.view)));
  window.RosterView.onChangeSeason=setViewSeason;
  window.RosterView.onEditSeasonStats=(playerId,seasonId)=>{
    showView('data');
    $('manualSeason').value=seasonId;
    $('manualPlayer').value=playerId;
    renderManualSeasonEditor();
    $('manualSeasonPanel').scrollIntoView({behavior:'smooth',block:'start'});
  };
  document.querySelectorAll('.season-view-select').forEach(select=>select.addEventListener('change',event=>setViewSeason(event.target.value)));
  $('matchSeason').addEventListener('change',event=>{state.draft.seasonId=event.target.value;persist();});
  $('seasonCards').addEventListener('click',event=>{const target=event.target.closest('[data-manage-view-season]');if(target)setViewSeason(target.dataset.manageViewSeason);});
  $('createNextSeason').addEventListener('click',startNextSeason);
  $('manualSeason').addEventListener('change',renderManualSeasonEditor);
  $('manualPlayer').addEventListener('change',renderManualSeasonEditor);
  $('saveManualSeason').addEventListener('click',saveManualSeason);
  $('clearManualSeason').addEventListener('click',()=>{
    const season=$('manualSeason').value,player=$('manualPlayer').value;
    if(!((state.manualSeasonStats[season]||{})[player]))return;
    if(!window.confirm('Clear all manual season overrides for this player? Saved match records remain unchanged.'))return;
    delete state.manualSeasonStats[season][player];
    if(!Object.keys(state.manualSeasonStats[season]).length)delete state.manualSeasonStats[season];
    persist();renderManualSeasonEditor();renderSeasonManager();notify('Manual season overrides cleared. Saved match totals are unchanged.');
  });
  $('methodSearch').addEventListener('input',renderMethodology);
  $('methodExpand').addEventListener('click',()=>$('methodGroups').querySelectorAll('details').forEach(d=>d.open=true));
  $('methodCollapse').addEventListener('click',()=>$('methodGroups').querySelectorAll('details').forEach(d=>d.open=false));
  fields.forEach(id=>$(id).addEventListener('input',()=>{
    readFields();if(id==='minutes'){$('minutes').value=state.draft.minutes;}
    renderLive();renderEvents();persist();
  }));
  $('mixedPositionPanel').addEventListener('input',event=>{
    const key=event.target.dataset.positionShare;
    if(!key)return;
    const value=Math.max(0,Math.min(100,Math.round(Number(event.target.value)||0)));
    state.draft.positionShares[key]=value;
    renderLive();renderEvents();persist();
  });
  $('mixedPositionPanel').addEventListener('change',event=>{
    const key=event.target.dataset.positionShare;
    if(key)event.target.value=state.draft.positionShares[key];
  });
  $('eventTabs').addEventListener('click',event=>{const button=event.target.closest('[data-tab]');if(!button)return;activeGroup=button.dataset.tab;renderEvents();renderLive();});
  $('eventGrid').addEventListener('toggle',event=>{if(event.target.id==='extraPassing')advancedPassingOpen=event.target.open;},true);
  $('eventGrid').addEventListener('click',event=>{
    const button=event.target.closest('[data-plus],[data-minus]');if(!button)return;
    const key=button.dataset.plus||button.dataset.minus;
    const direction=button.dataset.plus?1:-1;
    let value=state.draft.stats[key]+direction;
    if(key==='cleanSheet'||key==='red')value=Math.min(1,value);
    if(key==='yellow')value=Math.min(2,value);
    state.draft.stats[key]=Math.max(0,Math.min(99999,value));
    q(`[data-count="${key}"]`).value=state.draft.stats[key];
    renderLive();persist();
  });
  $('eventGrid').addEventListener('input',event=>{
    const key=event.target.dataset.count;if(!key)return;
    const maximum=(key==='cleanSheet'||key==='red')?1:key==='yellow'?2:99999;
    state.draft.stats[key]=Math.max(0,Math.min(maximum,Math.floor(Number(event.target.value)||0)));
    renderLive();persist();
  });
  $('eventGrid').addEventListener('change',event=>{if(event.target.dataset.count)event.target.value=state.draft.stats[event.target.dataset.count];});
  $('weightList').addEventListener('input',event=>{
    const key=event.target.dataset.weight;if(!key)return;
    const num=Number(event.target.value);
    if(Number.isFinite(num))state.weights[key]=Math.max(-10,Math.min(10,num));
    renderLive();persist();
  });
  $('weightList').addEventListener('change',event=>{if(event.target.dataset.weight){event.target.value=state.weights[event.target.dataset.weight];renderEvents();}});
  $('resetWeights').addEventListener('click',()=>{state.weights=E.defaultWeights();renderWeights();renderEvents();renderLive();persist();notify('Default weights restored. Saved reports remain unchanged.');});
  $('clearEvents').addEventListener('click',resetEvents);
  $('newMatch').addEventListener('click',newMatch);$('libraryNew').addEventListener('click',newMatch);
  $('saveMatch').addEventListener('click',saveMatch);$('saveMatchTop').addEventListener('click',saveMatch);
  $('previewReport').addEventListener('click',previewMatch);
  $('librarySearch').addEventListener('input',renderLibrary);$('librarySort').addEventListener('change',renderLibrary);
  $('libraryList').addEventListener('click',event=>{
    const btn=event.target.closest('[data-edit],[data-report],[data-delete]');if(!btn)return;
    const id=btn.dataset.edit||btn.dataset.report||btn.dataset.delete;
    const m=state.matches.find(x=>x.id===id);if(!m)return;
    if(btn.dataset.report){openReport(m);return;}
    if(btn.dataset.edit){state.draft={...m,positionShares:E.cleanPositionShares(m.positionShares),stats:{...m.stats}};state.weights={...m.weights};hydrateFields();renderEvents();renderLive();persist();showView('studio');notify('Performance loaded for editing.');return;}
    if(btn.dataset.delete){if(!window.confirm(`Permanently delete ${m.player}'s match vs ${m.opponent||'Unknown'}? Export a backup first if needed.`))return;state.matches=state.matches.filter(x=>x.id!==id);if(state.draft.id===id)state.draft.id=null;persist();renderLibrary();notify('Match deleted.');}
  });
  $('exportJSON').addEventListener('click',exportAllJSON);$('sideExport').addEventListener('click',exportAllJSON);
  $('exportCSV').addEventListener('click',exportAllCSV);$('libraryExportCSV').addEventListener('click',exportAllCSV);
  $('importButton').addEventListener('click',()=>$('importFile').click());
  $('importFile').addEventListener('change',event=>performImport(event.target.files[0]));
  $('reportClose').addEventListener('click',closeReport);
  $('reportModal').addEventListener('click',event=>{if(event.target===$('reportModal'))closeReport();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!$('reportModal').hidden)closeReport();});
  $('reportCSV').addEventListener('click',()=>{if(!reportMatch)return;S.download(reportFilename('csv'),S.exportReportCSV(reportMatch),'text/csv;charset=utf-8');notify('Complete event-by-event report CSV exported.');});
  $('reportJSON').addEventListener('click',()=>{if(!reportMatch)return;S.download(reportFilename('json'),JSON.stringify({type:'indoor-rating-studio-match',version:1,exportedAt:new Date().toISOString(),match:reportMatch},null,2),'application/json');notify('Match JSON exported. You can import this file later.');});
  $('reportPrint').addEventListener('click',()=>window.print());
  hydrateFields();renderEvents();renderLive();renderSeasonControls();renderLibrary();renderAnalytics();persist();
  if (loaded.migratedWeights) notify(`Updated ${loaded.migratedWeights} legacy default weights to the V3 Beta indoor calibration. Saved match reports were not changed.`);
})();
