/* Indoor Rating Studio V3 Beta — local Northland Nomads roster.
   Seeded profile details are public app content. Season totals are calculated only
   from matches stored locally on THIS device, never from other visitors.
   No changes to the event engine, weights or saved-match data format. */
(function (global) {
  'use strict';
  const players = [
    {name:'Matt Sattler',position:'mixed',birthdate:'08/26/2001'},
    {name:'Cubarsi Castillo',position:'defender',birthdate:null},
    {name:'Blake Aerni',position:'mixed',birthdate:null},
    {name:'Joe Epperson',position:'mixed',birthdate:null},
    {name:'John Paris',position:'mixed',birthdate:'06/12/2001'},
    {name:'Jason Snowden',position:'defender',birthdate:null},
    {name:'Seth Snowden',position:'mixed',birthdate:null},
    {name:'Jacob Garza',position:'mixed',birthdate:null},
    {name:'Josh Garza',position:'defender',birthdate:null},
    {name:'Michael Morgan',position:'defender',birthdate:null},
    {name:'Alex Finazzo',position:'mixed',birthdate:null},
    {name:'Anthony Valenciano',position:'forward',birthdate:null},
    {name:'Billy Lipp',position:'mixed',birthdate:null},
    {name:'Joe Reina',position:'mixed',birthdate:null},
    {name:'Jackson Williams',position:'mixed',birthdate:null}
  ].map((p,i)=>({ ...p,id:p.name.toLowerCase().replace(/[^a-z0-9]+/g,'-'),index:i,foot:'Right' }));
  const palette = [
    ['#8f7bfa','#55dac6'], ['#62b5ff','#a28cff'], ['#f085a9','#aa8eff'],
    ['#40c9b9','#65acff'], ['#b08bff','#ff94a7'], ['#66c5fd','#49d6bd']
  ];
  const root=document.getElementById('rosterRoot');
  if(!root)return;
  const clean=value=>String(value==null?'':value).replace(/[&<>"']/g,x=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
  const getInitials=name=>name.split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase();
  const canonical=name=>String(name||'').trim().toLowerCase().replace(/\s+/g,' ');
  const posLabel={mixed:'Mixed positions',defender:'Defender',forward:'Forward',midfielder:'Midfielder',keeper:'Goalkeeper'};
  const sum=(matches,key)=>matches.reduce((acc,m)=>acc+(Number(m?.stats?.[key])||0),0);
  const number=(n)=>Number(n||0).toLocaleString('en-US');
  let allMatches=[];
  let selectedId=null;
  let search='';
  let role='all';
  function matchesFor(player){return allMatches.filter(m=>canonical(m.player)===canonical(player.name));}
  function snapshot(player){
    const games=matchesFor(player);
    const goals=sum(games,'goals'),assists=sum(games,'assists');
    const totalPasses=sum(games,'passGood')+sum(games,'passBad');
    const totalDribbles=sum(games,'dribbleWon')+sum(games,'dribbleLost');
    const totalShots=sum(games,'goals')+sum(games,'shotsOn')+sum(games,'shotsOff')+sum(games,'shotBlocked')+sum(games,'bigMisses')+sum(games,'exceptionalMiss');
    const rating=games.length?games.reduce((total,m)=>total+(Number(m.rating)||0),0)/games.length:null;
    const percentage=(won,total)=>total?Math.round(won/total*100)+'%':'—';
    return {
      games,apps:games.length,goals,assists,rating,minutes:games.reduce((t,m)=>t+(Number(m.minutes)||0),0),
      passes:sum(games,'passGood'),passAttempts:totalPasses,passPct:percentage(sum(games,'passGood'),totalPasses),
      dribbles:sum(games,'dribbleWon'),dribbleAttempts:totalDribbles,dribblePct:percentage(sum(games,'dribbleWon'),totalDribbles),
      shotsOn:sum(games,'goals')+sum(games,'shotsOn'),shotAttempts:totalShots,
      shotPct:percentage(sum(games,'goals')+sum(games,'shotsOn'),totalShots),
      tackles:sum(games,'tackles'),interceptions:sum(games,'intercepts'),blocks:sum(games,'blocks'),
      recoveries:sum(games,'recoveries'),keyPasses:sum(games,'keyPass'),
      turnovers:sum(games,'passBad')+sum(games,'dribbleLost')+sum(games,'posLost')+sum(games,'badTouch')
    };
  }
  function avatar(player,large=false){
    const [colorA,colorB]=palette[player.index%palette.length];
    return `<span class="roster-avatar${large?' roster-avatar-large':''}" style="--roster-a:${colorA};--roster-b:${colorB}" aria-hidden="true"><span>${clean(getInitials(player.name))}</span></span>`;
  }
  function kpi(label,value,detail,accent='purple'){
    return `<div class="roster-kpi roster-accent-${accent}"><span>${clean(label)}</span><strong>${clean(value)}</strong><small>${clean(detail)}</small></div>`;
  }
  function renderIndex(){
    // A name-only squad directory. Performance data is shown inside player profiles.
    const ordered=players.slice();
    const visible=ordered.filter(p=>(role==='all'||p.position===role)&&canonical(p.name).includes(canonical(search)));
    function playerRow(player){
      return `<button type="button" class="roster-name-row" data-roster-player="${player.id}" aria-label="View ${clean(player.name)} profile">
        ${avatar(player)}
        <span class="roster-name-identity"><strong>${clean(player.name)}</strong><small>${clean(posLabel[player.position])}</small></span>
        <span class="roster-name-arrow" aria-hidden="true">›</span>
      </button>`;
    }
    root.innerHTML=`
      <header class="la-roster-banner">
        <div class="la-roster-banner-copy"><div class="la-roster-team">Northland Nomads</div><h1>Roster</h1><p>2026/27 Indoor Season</p></div>
        <div class="la-roster-diagonals" aria-hidden="true"><i></i><i></i></div>
        <div class="la-roster-mark" aria-hidden="true"><i></i><i></i></div>
      </header>
      <section class="la-roster-body" aria-label="Northland Nomads player directory">
        <div class="roster-controls">
          <div class="roster-filter" role="group" aria-label="Filter players by position">${[['all','All Players'],['mixed','Mixed'],['forward','FWD'],['defender','DEF']].map(([key,label])=>`<button class="roster-filter-btn${role===key?' active':''}" type="button" data-roster-filter="${key}" aria-pressed="${role===key}">${label}</button>`).join('')}</div>
          <label class="roster-search"><span aria-hidden="true">⌕</span><input id="rosterSearch" type="search" placeholder="Search roster..." autocomplete="off" value="${clean(search)}" aria-label="Search team roster"></label>
        </div>
        <div class="roster-name-grid">${visible.map(playerRow).join('')}${visible.length?'':'<div class="roster-no-results">No players match your search or selected position.</div>'}</div>
      </section>`;
    const input=document.getElementById('rosterSearch');
    if(input){input.addEventListener('input',e=>{const caret=e.target.selectionStart;search=e.target.value;renderIndex();const next=document.getElementById('rosterSearch');next.focus();try{next.setSelectionRange(caret,caret)}catch(_){}});}
  }
  function statPanel(title,rows,subtitle){
    return `<section class="roster-stat-panel"><div class="roster-stat-panel-heading"><h3>${clean(title)}</h3>${subtitle?`<small>${clean(subtitle)}</small>`:''}</div><div class="roster-stat-rows">${rows.map(([name,value])=>`<div class="roster-stat-row"><span>${clean(name)}</span><strong>${clean(value)}</strong></div>`).join('')}</div></section>`;
  }
  function renderProfile(player){
    const stats=snapshot(player);
    const dates=stats.games.slice().sort((a,b)=>String(b.date).localeCompare(String(a.date))).slice(0,6);
    const [colorA,colorB]=palette[player.index%palette.length];
    const latest=dates.length?`<section class="roster-recent"><div class="roster-stat-panel-heading"><h3>Recent performances</h3><small>Saved matches on this device</small></div>${dates.map(match=>`<div class="roster-recent-row"><div><strong>vs ${clean(match.opponent||'Opponent not recorded')}</strong><span>${clean(match.date)} · ${number(match.minutes)} min</span></div><div class="roster-recent-rating">${Number(match.rating).toFixed(1)}</div></div>`).join('')}</section>`:'<div class="roster-empty-records">No match performances have been saved for this player yet. Their season statistics will update when matches are recorded under this name.</div>';
    root.innerHTML=`
      <div class="roster-profile-top"><button type="button" class="roster-back" data-roster-back><span aria-hidden="true">←</span> Back to roster</button><span class="roster-profile-top-meta">NORTHLAND NOMADS <span> / </span> PLAYER PROFILE</span></div>
      <div class="roster-profile-layout">
        <aside class="roster-profile-side"><div class="roster-profile-hero" style="--roster-a:${colorA};--roster-b:${colorB}"><div class="roster-profile-hero-kicker">NORTHLAND NOMADS <span>·</span> PLAYER PROFILE</div><div class="roster-portrait">${avatar(player,true)}<span class="roster-portrait-arc" aria-hidden="true"></span></div><div class="roster-profile-name">${clean(player.name)}</div><div class="roster-profile-subline"><span>Northland Nomads</span><span>${clean(posLabel[player.position])}</span></div></div>
          <div class="roster-biography"><div class="roster-bio-header">PLAYER INFORMATION</div><div class="roster-bio-grid"><div><span>Positions</span><strong>${clean(posLabel[player.position])}</strong></div><div><span>Birthdate</span><strong>${clean(player.birthdate||'—')}</strong></div><div><span>Preferred foot</span><strong>${clean(player.foot)}</strong></div><div><span>Club</span><strong>Northland Nomads</strong></div></div></div>
          <div class="roster-profile-footnote">Roster details are preloaded. Match statistics shown here are personal to this device.</div>
        </aside>
        <div class="roster-profile-main"><div class="roster-profile-title"><div><div class="eyebrow">PLAYER PERFORMANCE <span class="eyebrow-line"></span> SEASON TOTALS</div><h2>${clean(player.name)}</h2><p>${clean(posLabel[player.position])} · ${stats.apps} recorded ${stats.apps===1?'appearance':'appearances'}</p></div></div>
          <div class="roster-profile-kpis">${kpi('Appearances',stats.apps,'Recorded matches','purple')}${kpi('Goals',stats.goals,'Total scored','coral')}${kpi('Assists',stats.assists,'Total created','mint')}${kpi('Average rating',stats.rating===null?'—':stats.rating.toFixed(1),'Across appearances','blue')}</div>
          <div class="roster-stats-section"><h3>Player statistics<span>.</span></h3><p>Compiled automatically from saved match reports.</p></div>
          <div class="roster-profile-stats-grid">
          ${statPanel('Attack',[['Goals',stats.goals],['Assists',stats.assists],['Shots on target',stats.shotsOn],['Shot accuracy',stats.shotPct]])}
          ${statPanel('Possession',[['Passes completed',number(stats.passes)],['Pass completion',stats.passPct],['Dribbles completed',number(stats.dribbles)],['Dribble completion',stats.dribblePct],['Possession lost',number(stats.turnovers)]])}
          ${statPanel('Defending',[['Successful tackles',number(stats.tackles)],['Interceptions',number(stats.interceptions)],['Blocked shots',number(stats.blocks)],['Ball recoveries',number(stats.recoveries)]])}
          ${statPanel('Playing time',[['Appearances',stats.apps],['Minutes played',number(stats.minutes)],['Average rating',stats.rating===null?'—':stats.rating.toFixed(1)],['Key passes',number(stats.keyPasses)]])}
          </div>
          ${latest}
        </div>
      </div>`;
  }
  root.addEventListener('click',event=>{
    const selected=event.target.closest('[data-roster-player]');
    if(selected){selectedId=selected.dataset.rosterPlayer;const player=players.find(p=>p.id===selectedId);if(player){renderProfile(player);window.scrollTo({top:0,behavior:'instant'});}return;}
    const filter=event.target.closest('[data-roster-filter]');
    if(filter){role=filter.dataset.rosterFilter;renderIndex();return;}
    if(event.target.closest('[data-roster-back]')){selectedId=null;renderIndex();window.scrollTo({top:0,behavior:'instant'});}
  });
  global.RosterView={
    players,
    render(matches){allMatches=Array.isArray(matches)?matches:[];const player=players.find(p=>p.id===selectedId);if(player)renderProfile(player);else renderIndex();}
  };
})(window);
