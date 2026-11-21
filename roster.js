/* Indoor Rating Studio V3 Beta — local Northland Nomads roster.
   Seeded profile details are public app content. Season totals are calculated only
   from matches stored locally on THIS device, never from other visitors.
   No changes to the event engine, weights or saved-match data format. */
(function (global) {
  'use strict';
  const playerPhotos = Object.freeze({
    'matt-sattler': 'matt-sattler',
    'john-paris': 'john-paris'
  });
  const players = [
    {name:'Matt Sattler',position:'mixed',birthdate:'08/26/2001',hometown:'Kansas City'},
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
  ].map((p,i)=>({ ...p,id:p.name.toLowerCase().replace(/[^a-z0-9]+/g,'-'),index:i,foot:'Right', photo:playerPhotos[p.name.toLowerCase().replace(/[^a-z0-9]+/g,'-')]||null }));
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
  let seasonId='2027';
  let seasons=[];
  let manualSeasonStats={};
  let selectedId=null;
  let search='';
  let role='all';
  function matchesFor(player){return allMatches.filter(m=>canonical(m.player)===canonical(player.name) && m.seasonId===seasonId);}
  function snapshot(player){
    const games=matchesFor(player);
    const manual=(manualSeasonStats[seasonId]||{})[player.id] || {};
    const sumKey=key=>Object.prototype.hasOwnProperty.call(manual,key)?manual[key]:sum(games,key);
    const goals=sumKey('goals'),assists=sumKey('assists');
    const passes=sumKey('passGood'), passAttempts=passes+sumKey('passBad');
    const dribbles=sumKey('dribbleWon'), dribbleAttempts=dribbles+sumKey('dribbleLost');
    const shotsOn=goals+sumKey('shotsOn');
    const shotAttempts=shotsOn+sumKey('shotsOff')+sumKey('shotBlocked')+sumKey('bigMisses')+sumKey('exceptionalMiss');
    const rating=games.length?games.reduce((total,m)=>total+(Number(m.rating)||0),0)/games.length:null;
    const percentage=(won,total)=>total?Math.round(won/total*100)+'%':'—';
    return {
      games,manual,allEvents:Object.fromEntries(global.RatingEngine.EVENTS.map(ev=>[ev.key,sumKey(ev.key)])),
      apps:Object.prototype.hasOwnProperty.call(manual,'appearances')?manual.appearances:games.length,
      goals,assists,rating,recordedGames:games.length,
      minutes:Object.prototype.hasOwnProperty.call(manual,'minutes')?manual.minutes:games.reduce((t,m)=>t+(Number(m.minutes)||0),0),
      passes,passAttempts,passPct:percentage(passes,passAttempts),
      dribbles,dribbleAttempts,dribblePct:percentage(dribbles,dribbleAttempts),
      shotsOn,shotAttempts,shotPct:percentage(shotsOn,shotAttempts),
      tackles:sumKey('tackles'),interceptions:sumKey('intercepts'),blocks:sumKey('blocks'),
      recoveries:sumKey('recoveries'),keyPasses:sumKey('keyPass'),
      turnovers:sumKey('passBad')+sumKey('dribbleLost')+sumKey('posLost')+sumKey('badTouch')
    };
  }
  const seasonOptions=()=>seasons.map(s=>`<option value="${clean(s.id)}" ${s.id===seasonId?'selected':''}>${clean(s.name)}${s.archived?' · Archive':''}</option>`).join('');
  const seasonControl=()=>`<label class="roster-season-control">SEASON <select data-roster-season aria-label="Roster season">${seasonOptions()}</select></label>`;
  function avatar(player,large=false){
    const [colorA,colorB]=palette[player.index%palette.length];
    const photo=player.photo;
    const content=photo
      ? `<img src="player-photos/${photo}${large?'':'-thumb'}.png" alt="" loading="${large?'eager':'lazy'}" decoding="async" width="${large?'720':'256'}" height="${large?'850':'256'}">`
      : `<span>${clean(getInitials(player.name))}</span>`;
    return `<span class="roster-avatar${large?' roster-avatar-large':''}${photo?' has-photo':''}" style="--roster-a:${colorA};--roster-b:${colorB}" aria-hidden="true">${content}</span>`;
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
        <div class="la-roster-banner-copy"><div class="la-roster-team">Northland Nomads</div><h1>Roster</h1><p>${clean(seasonId)} Indoor Season</p></div>
        <div class="la-roster-diagonals" aria-hidden="true"><i></i><i></i></div>
        <div class="la-roster-mark" aria-hidden="true"><i></i><i></i></div>
      </header>
      <section class="la-roster-body" aria-label="Northland Nomads player directory">
        <div class="roster-controls">
          ${seasonControl()}
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
      <div class="roster-profile-top"><button type="button" class="roster-back" data-roster-back><span aria-hidden="true">←</span> Back to roster</button>${seasonControl()}<span class="roster-profile-top-meta">ROSTER <span> / </span> PLAYER PROFILE</span></div>
      <div class="roster-profile-layout">
        <div class="roster-profile-hero" style="--roster-a:${colorA};--roster-b:${colorB}">
          <div class="roster-portrait">${avatar(player,true)}</div>
          <div class="roster-profile-hero-kicker">FIRST TEAM <span>·</span> PLAYER PROFILE</div>
          <div class="roster-profile-identity"><div class="roster-profile-name">${clean(player.name)}</div>
            <div class="roster-hero-info"><div><span>Position</span><strong>${clean(posLabel[player.position])}</strong></div><div><span>Birthdate</span><strong>${clean(player.birthdate||'—')}</strong></div><div><span>Preferred foot</span><strong>${clean(player.foot)}</strong></div><div><span>Club</span><strong>Northland Nomads</strong></div><div><span>Hometown</span><strong>${clean(player.hometown||'—')}</strong></div></div></div>
        </div>
        <div class="roster-profile-main"><div class="roster-profile-title"><div><div class="eyebrow">PLAYER PERFORMANCE <span class="eyebrow-line"></span> ${clean(seasonId)} SEASON</div><h2>Season overview</h2><p>${clean(posLabel[player.position])} · ${stats.apps} ${stats.apps===1?'appearance':'appearances'} · ${stats.recordedGames} rated matches</p></div><button type="button" class="btn btn-secondary" data-season-edit-player="${clean(player.id)}">Edit season statistics</button></div>
          <div class="roster-profile-kpis">${kpi('Appearances',stats.apps,'Recorded matches','purple')}${kpi('Goals',stats.goals,'Total scored','coral')}${kpi('Assists',stats.assists,'Total created','mint')}${kpi('Average rating',stats.rating===null?'—':stats.rating.toFixed(1),'Recorded matches only','blue')}</div>
          <div class="roster-stats-section"><h3>Player statistics<span>.</span></h3><p>Saved-match totals, with any manually entered season totals taking precedence.</p></div>
          <div class="roster-profile-stats-grid">
          ${statPanel('Attack',[['Goals',stats.goals],['Assists',stats.assists],['Shots on target',stats.shotsOn],['Shot accuracy',stats.shotPct]])}
          ${statPanel('Possession',[['Passes completed',number(stats.passes)],['Pass completion',stats.passPct],['Dribbles completed',number(stats.dribbles)],['Dribble completion',stats.dribblePct],['Possession lost',number(stats.turnovers)]])}
          ${statPanel('Defending',[['Successful tackles',number(stats.tackles)],['Interceptions',number(stats.interceptions)],['Blocked shots',number(stats.blocks)],['Ball recoveries',number(stats.recoveries)]])}
          ${statPanel('Playing time',[['Appearances',stats.apps],['Minutes played',number(stats.minutes)],['Average rating',stats.rating===null?'—':stats.rating.toFixed(1)],['Key passes',number(stats.keyPasses)]])}
          </div>
          <details class="roster-all-events"><summary>View all 40 season statistics</summary><div class="roster-all-event-grid">${global.RatingEngine.GROUPS.map(g=>`<div class="roster-all-event-group"><h4>${clean(g.title)}</h4>${g.events.map(([key,label])=>`<div><span>${clean(label)}${Object.prototype.hasOwnProperty.call(stats.manual,key)?' <small>Manual</small>':''}</span><strong>${number(stats.allEvents[key])}</strong></div>`).join('')}</div>`).join('')}</div></details>
          ${latest}
        </div>
      </div>`;
  }
  root.addEventListener('change',event=>{if(event.target.matches('[data-roster-season]') && global.RosterView.onChangeSeason)global.RosterView.onChangeSeason(event.target.value);});
  root.addEventListener('click',event=>{
    const edit=event.target.closest('[data-season-edit-player]');
    if(edit){if(global.RosterView.onEditSeasonStats)global.RosterView.onEditSeasonStats(edit.dataset.seasonEditPlayer,seasonId);return;}
    const selected=event.target.closest('[data-roster-player]');
    if(selected){selectedId=selected.dataset.rosterPlayer;const player=players.find(p=>p.id===selectedId);if(player){renderProfile(player);window.scrollTo({top:0,behavior:'instant'});}return;}
    const filter=event.target.closest('[data-roster-filter]');
    if(filter){role=filter.dataset.rosterFilter;renderIndex();return;}
    if(event.target.closest('[data-roster-back]')){selectedId=null;renderIndex();window.scrollTo({top:0,behavior:'instant'});}
  });
  global.RosterView={
    players,
    render(matches, selectedSeason, manual, catalog){
      allMatches=Array.isArray(matches)?matches:[];
      if(selectedSeason)seasonId=String(selectedSeason);
      manualSeasonStats=manual||{};
      seasons=Array.isArray(catalog)?catalog:[];
      const player=players.find(p=>p.id===selectedId);if(player)renderProfile(player);else renderIndex();
    }
  };
})(window);
