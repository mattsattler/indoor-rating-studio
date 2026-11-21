/* Northland Nomads — player and season comparisons.
   Read-only. Season overrides have the same replacement semantics as the roster.
   Ratings and event impact are calculated ONLY from saved match performances. */
(function (global) {
  'use strict';
  const E=global.RatingEngine;
  const S=global.RatingStorage;
  const root=document.getElementById('comparisonRoot');
  if(!root || !E || !S || !global.RosterView)return;
  const players=global.RosterView.players;
  const safe=(s)=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const integer=(n)=>Number(n||0).toLocaleString('en-US');
  const digits=(n,d=1)=>Number(n).toFixed(d);
  const valid=(s)=>Number.isFinite(Number(s));
  let data=null;
  let choice={a:players[0]?.id||'',b:players[4]?.id||players[1]?.id||'',as:null,bs:null};
  let mode='totals';
  const groupMap=Object.fromEntries(E.GROUPS.map(g=>[g.id,g]));
  const monthLabel=(id)=>String(id||'')+' Season';
  const defaultSeason=()=>data?.viewSeasonId || data?.activeSeasonId || '2027';
  function options(items,selected){return items.map(item=>`<option value="${safe(item.value)}" ${item.value===selected?'selected':''}>${safe(item.label)}</option>`).join('');}
  function playersOptions(id){return options(players.map(p=>({value:p.id,label:p.name})),id);}
  function seasonsOptions(id){return options(data.seasons.map(s=>({value:s.id,label:s.name+(s.archived?' · Archived':' · Active')})),id);}
  function zeroRate(good,total){return total>0 ? (100*good/total).toFixed(0)+'%' : '—';}
  const isManual=(obj,key)=>Object.prototype.hasOwnProperty.call(obj,key);

  function snapshot(playerId,seasonId) {
    const player=players.find(p=>p.id===playerId) || players[0];
    const games=data.matches.filter(m=>S.playerKey(m.player)===player.id && m.seasonId===seasonId);
    const overrides=(data.manualSeasonStats?.[seasonId]||{})[player.id]||{};
    const totals=Object.fromEntries(E.EVENTS.map(event=>[
      event.key,isManual(overrides,event.key)?overrides[event.key]:games.reduce((n,g)=>n+Number(g.stats[event.key]||0),0)
    ]));
    const appearances=isManual(overrides,'appearances')?overrides.appearances:games.length;
    const minutes=isManual(overrides,'minutes')?overrides.minutes:games.reduce((n,g)=>n+Number(g.minutes||0),0);
    const passAttempts=totals.passGood+totals.passBad;
    const dribbleAttempts=totals.dribbleWon+totals.dribbleLost;
    const on=totals.goals+totals.shotsOn;
    const shotAttempts=on+totals.shotsOff+totals.shotBlocked+totals.bigMisses+totals.exceptionalMiss;
    const turnovers=totals.passBad+totals.dribbleLost+totals.badTouch+totals.posLost;
    const wins=games.filter(g=>g.result==='win').length;
    const recorded=games.map(g=>E.calculate(g.stats,g.position,g.weights,g.positionShares));
    const avgRating=recorded.length ? recorded.reduce((n,r)=>n+r.rating,0)/recorded.length:null;
    const impacts=Object.fromEntries(E.GROUPS.map(g=>[
      g.id,recorded.length?recorded.reduce((sum,r)=>sum+r.groups.find(x=>x.id===g.id).subtotal,0)/recorded.length:null
    ]));
    return {player,seasonId,games,recordedCount:recorded.length,manual:overrides,totals,appearances,minutes,
      passAttempts,passRate:zeroRate(totals.passGood,passAttempts),dribbleAttempts,dribbleRate:zeroRate(totals.dribbleWon,dribbleAttempts),
      shotsOn:on,shotAttempts,shotRate:zeroRate(on,shotAttempts),duelRate:zeroRate(totals.duelsWon,totals.duelsWon+totals.duelsLost),
      turnovers,wins,avgRating,impacts,hasManual:Object.keys(overrides).length>0};
  }
  function rate(n,min){return min>0?digits(n/min*50,2):'—';}
  function numberValue(v){return valid(v)?Number(v):null;}
  function scaled(val,snap){return mode==='per50'?snap.minutes>0?val*50/snap.minutes:null:val;}
  function show(v,precision=0){return v===null||v===undefined?'—':precision?digits(v,precision):integer(v);}
  function row(label,x,y,{format='count',manualKey=null,as=null,bs=null}={}){
    const xValue=format==='rate'?x:format==='average'?x:(format==='count'?scaled(x,as):x);
    const yValue=format==='rate'?y:format==='average'?y:(format==='count'?scaled(y,bs):y);
    const formatted=(v)=>format==='rate'?v??'—':format==='average'?show(v,2):show(v,mode==='per50'&&format==='count'?2:0);
    const mark=(snap)=>manualKey&&isManual(snap.manual,manualKey)?'<span class="compare-manual-label" title="Manual season override">Manual</span>':'';
    // Graphics are relative to the two values, never a league benchmark or an implied rating.
    const max=Math.max(0,numberValue(xValue)||0,numberValue(yValue)||0);
    const bar=(v,color)=>format!=='count'||!max||v===null?'':`<div class="compare-bar"><i class="${color}" style="width:${Math.max(0,v/max*100).toFixed(2)}%"></i></div>`;
    return `<div class="compare-stat-row"><span class="compare-stat-label">${safe(label)}</span><div class="compare-stat-side compare-a"><strong>${safe(formatted(xValue))}</strong>${as?mark(as):''}${bar(xValue,'bar-a')}</div><div class="compare-stat-side compare-b"><strong>${safe(formatted(yValue))}</strong>${bs?mark(bs):''}${bar(yValue,'bar-b')}</div></div>`;
  }
  function statColumn(label,a,b,opts){return row(label,a,b,opts);}
  function panel(title,rows,subtitle=''){
    return `<section class="compare-panel"><div class="compare-panel-head"><h3>${safe(title)}</h3>${subtitle?`<span>${safe(subtitle)}</span>`:''}</div><div class="compare-panel-rows">${rows}</div></section>`;
  }
  function build(){
    const a=snapshot(choice.a,choice.as),b=snapshot(choice.b,choice.bs);
    const isPer50=mode==='per50';
    const R=(label,x,y,opts={})=>statColumn(label,x,y,{as:a,bs:b,...opts});
    const G=(key)=>[a.totals[key],b.totals[key]];
    const seasonSelect=(side)=>`<label><span>Season</span><select data-compare-${side}-season aria-label="${side==='a'?'Left':'Right'} player season">${seasonsOptions(choice[side+'s'])}</select></label>`;
    const playerSelect=(side)=>`<label><span>Player</span><select data-compare-${side}-player aria-label="${side==='a'?'Left':'Right'} player name">${playersOptions(choice[side])}</select></label>`;
    const avg=(s)=>s.avgRating===null?'—':s.avgRating.toFixed(1);
    const note=(s)=>s.hasManual?'<span class="compare-season-override">Includes manually entered season totals</span>':'<span class="compare-season-record">From recorded match totals</span>';
    const card=(s,side)=>`<div class="compare-player compare-player-${side}"><div class="compare-player-marker">${safe(s.player.name.split(/\s+/).map(p=>p[0]).slice(0,2).join(''))}</div><div class="compare-player-identity"><span>${safe(monthLabel(s.seasonId))}</span><h2>${safe(s.player.name)}</h2><small>${safe(s.player.position==='mixed'?'Mixed position':s.player.position.charAt(0).toUpperCase()+s.player.position.slice(1))}</small></div><div class="compare-player-rating"><span>Average rating</span><strong>${avg(s)}</strong><small>${s.recordedCount} rated ${s.recordedCount===1?'match':'matches'}</small></div>${note(s)}</div>`;
    const groups=E.GROUPS.map(group=>{
      const rows=group.events.map(([key,label])=>R(label,...G(key),{manualKey:key})).join('');
      const impactA=a.impacts[group.id],impactB=b.impacts[group.id];
      const impactText=v=>v===null?'—':(v>=0?'+':'')+v.toFixed(2);
      return `<details class="compare-event-group" ${group.id==='attack'?'open':''}><summary><span>${safe(group.title)} <small>${group.events.length} events</small></span><span class="compare-summary-right">${impactText(impactA)} <em>vs</em> ${impactText(impactB)} <small>avg impact</small></span><span class="compare-chevron">⌄</span></summary><div class="compare-group-rows">${rows}</div></details>`;
    }).join('');

    const table=panel('Season totals',[
      R('Appearances',a.appearances,b.appearances,{manualKey:'appearances',format:'plain'}),
      R('Minutes played',a.minutes,b.minutes,{manualKey:'minutes',format:'plain'}),
      R('Goals',...G('goals'),{manualKey:'goals'}),
      R('Assists',...G('assists'),{manualKey:'assists'}),
      R('Goal contributions',a.totals.goals+a.totals.assists,b.totals.goals+b.totals.assists),
      R('Goal contributions / 50 min',a.minutes?((a.totals.goals+a.totals.assists)/a.minutes*50):null,b.minutes?((b.totals.goals+b.totals.assists)/b.minutes*50):null,{format:'average'}),
      R('Possession lost',a.turnovers,b.turnovers),
      R('Successful tackles',...G('tackles'),{manualKey:'tackles'}),
      R('Interceptions',...G('intercepts'),{manualKey:'intercepts'}),
    ].join(''),'Totals and per-50 rates use effective season statistics');
    const efficiency=panel('Efficiency & distribution',[
      R('Passing completion',a.passRate,b.passRate,{format:'rate'}),
      R('Completed passes',...G('passGood'),{manualKey:'passGood'}),
      R('Pass attempts',a.passAttempts,b.passAttempts),
      R('Dribble completion',a.dribbleRate,b.dribbleRate,{format:'rate'}),
      R('Dribbles completed',...G('dribbleWon'),{manualKey:'dribbleWon'}),
      R('Dribble attempts',a.dribbleAttempts,b.dribbleAttempts),
      R('Shot accuracy',a.shotRate,b.shotRate,{format:'rate'}),
      R('Shots on target (inc. goals)',a.shotsOn,b.shotsOn),
      R('Shot attempts',a.shotAttempts,b.shotAttempts),
      R('Duel win rate',a.duelRate,b.duelRate,{format:'rate'})
    ].join(''),'Percentages are calculated from event counts');
    const impacts=panel('Rating contributions',[
      R('Average match rating',a.avgRating,b.avgRating,{format:'average'}),
      ...E.GROUPS.map(g=>R(g.title+' impact / rated match',a.impacts[g.id],b.impacts[g.id],{format:'average'})),
      R('Rated matches',a.recordedCount,b.recordedCount,{format:'plain'})
    ].join(''),'Only individually saved performances · rating formula unchanged');
    root.innerHTML=`<div class="compare-body">
      <div class="compare-picker-grid"><div class="compare-picker compare-picker-a">${playerSelect('a')}${seasonSelect('a')}</div><button type="button" class="compare-swap" data-compare-swap aria-label="Swap players and seasons" title="Swap players and seasons">⇄</button><div class="compare-picker compare-picker-b">${playerSelect('b')}${seasonSelect('b')}</div></div>
      <div class="compare-feature-grid">${card(a,'a')}${card(b,'b')}</div>
      <div class="compare-controls"><div><strong>Performance breakdown</strong><span>Both sides are based on the selected season</span></div><div class="compare-mode" role="group" aria-label="Event display units"><button data-compare-mode="totals" class="${!isPer50?'active':''}" aria-pressed="${!isPer50}">Totals</button><button data-compare-mode="per50" class="${isPer50?'active':''}" aria-pressed="${isPer50}">Per 50 minutes</button></div></div>
      <div class="compare-table-head"><span>Metric</span><strong>${safe(a.player.name)}</strong><strong>${safe(b.player.name)}</strong></div>
      <div class="compare-main-grid">${table}${efficiency}</div>${impacts}
      <section class="compare-all-events"><div class="compare-subhead"><h2>Complete event comparison</h2><p>All 40 tracked events by the five existing categories. Expand each group to see every count.</p></div>${groups}</section>
      <div class="compare-disclaimer"><strong>Reading the comparison:</strong> Manually entered season totals replace matching match-derived totals; they are never added again. “Per 50 minutes” normalizes event counts only—it does not alter ratings. Percentages stay unchanged. A dash means an undefined rate or no recorded rating, not zero. Category impacts and average ratings come exclusively from saved, individually rated matches; season-only totals cannot recreate them. Relative bars compare these two selected values, not a league benchmark. Data is stored on this device.</div>
    </div>`;
  }
  root.addEventListener('change',e=>{
    const el=e.target;
    if(el.matches('[data-compare-a-player]'))choice.a=el.value;
    else if(el.matches('[data-compare-b-player]'))choice.b=el.value;
    else if(el.matches('[data-compare-a-season]'))choice.as=el.value;
    else if(el.matches('[data-compare-b-season]'))choice.bs=el.value;
    else return;
    build();
  });
  root.addEventListener('click',e=>{
    const swap=e.target.closest('[data-compare-swap]');
    if(swap){[choice.a,choice.b]=[choice.b,choice.a];[choice.as,choice.bs]=[choice.bs,choice.as];build();return;}
    const unit=e.target.closest('[data-compare-mode]');
    if(unit){mode=unit.dataset.compareMode==='per50'?'per50':'totals';build();}
  });
  global.ComparisonView={
    render(state,seasonId){
      data=state;
      const ids=new Set(data.seasons.map(s=>s.id));
      if(!ids.has(choice.as))choice.as=ids.has(seasonId)?seasonId:defaultSeason();
      if(!ids.has(choice.bs))choice.bs=ids.has(seasonId)?seasonId:defaultSeason();
      if(!players.some(p=>p.id===choice.a))choice.a=players[0].id;
      if(!players.some(p=>p.id===choice.b))choice.b=players[1].id;
      build();
    },
    // Pure, read-only view: never changes state or the saved match library.
    getSelection(){return {...choice};}
  };
})(window);
