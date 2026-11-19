/* Indoor Rating Studio V3 Beta — MASL-informed, proportionally calibrated event scoring.
   The 2025-26 MASL completed season provides FREQUENCY BENCHMARKS, NOT event weights.
   Based on 1150 goals in 96 games (11.98 combined goals/game).
   MASL public stats DO NOT publish passes/dribbles/turnovers or a player-rating algorithm.
   Original event weights were proportionally adjusted to set these final defaults using the
   USER-AGREED anchor 1.10 outdoor goal -> 0.70 indoor goal (factor 7/11).
   This is a provisional, editable model; NOT official MASL/SofaScore scoring. */
(function (global) {
  'use strict';
  const BASE = 6.5;
  const MIN = 3;
  const MAX = 10;
  const CALIBRATION = Object.freeze({
    version: '3.0-beta',
    label: 'MASL-informed 2025-26 starting model',
    league: 'Major Arena Soccer League',
    season: '2025-26',
    seasonMatches: 96,
    seasonGoals: 1150,
    goalsPerGame: 1150 / 96,
    maslMinutes: 60,
    studioMinutes: 50,
    outdoorGoalAnchor: 1.10,
    indoorGoalTarget: 0.70,
    weightMultiplier: 0.70 / 1.10,
    methodology: 'MASL supplies scoring frequency, not proprietary event weights. Apply proportional scaling to the earlier event weights; set goal to +0.70 by agreement. Recalibrate against local match data.'
  });
  const GROUPS = [
    { id: 'attack', title: 'Attacking', short: 'Attack', tint: '#ff7d89', description: 'Finishing, chance creation and 1v1s', events: [
      ['goals', 'Goals', 0.7, 'Goals scored'],
      ['assists', 'Assists', 0.47727, 'Final pass leading directly to a goal'],
      ['shotsOn', 'Shots on target (saved)', 0.075, 'Shots on goal stopped by the goalkeeper, excluding goals. Do not record the same shot as a goal.'],
      ['shotsOff', 'Shots off target', -0.025, 'Ordinary shots that miss the goal. Do not include big chances missed or exceptional misses.'],
      ['shotBlocked', 'Shots blocked (attempts)', 0, 'Your attempts blocked by opposing defenders. Not the same as defensive blocked shots.'],
      ['bigChances', 'Big chances created', 0.15273, 'Clear scoring opportunities created'],
      ['bigMisses', 'Big chances missed', -0.23, 'A clear, high-quality chance sent off target. Count here INSTEAD of Shots off target.'],
      ['exceptionalMiss', 'Exceptional chances missed', -0.3, 'A very high-quality open chance sent off target. Count here INSTEAD of the other missed-shot categories.'],
      ['dribbleWon', 'Dribbles completed', 0.09545, 'Successful take-ons. Count each completed dribble once.'],
      ['dribbleLost', 'Unsuccessful dribbles', -0.07636, 'Failed take-ons; included automatically in total possession lost']
    ]},
    { id: 'passing', title: 'Passing', short: 'Passing', tint: '#8e8bff', description: 'Passing accuracy, creation and distribution', events: [
      ['passGood', 'Passes completed', 0.00955, 'Successful passes. Includes key passes, accurate long passes and through balls.'],
      ['passBad', 'Inaccurate passes', -0.02864, 'Uncompleted passes; included automatically in total possession lost'],
      ['keyPass', 'Key passes', 0.12727, 'Passes immediately leading to a shot; already included in completed passes'],
      ['longGood', 'Long passes completed', 0.03818, 'Successful long passes; already included in passes completed'],
      ['through', 'Successful through balls', 0.08909, 'Through balls received by teammates; already included in completed passes'],
      ['crossGood', 'Accurate crosses', 0.05091, 'Subset of accurate passes']
    ]},
    { id: 'defense', title: 'Defending', short: 'Defense', tint: '#39d5bd', description: 'Winning and protecting possession', events: [
      ['tackles', 'Successful tackles', 0.10818, 'Tackles that stop or dispossess an opponent'],
      ['tackleLost', 'Failed tackles', -0.035, 'Unsuccessful tackle attempts'],
      ['intercepts', 'Interceptions', 0.09545, 'Cutting out an opponent’s pass'],
      ['blocks', 'Blocked shots', 0.10818, 'Stopping an attempted shot'],
      ['clearances', 'Clearances', 0.035, 'Removing the ball from danger'],
      ['duelsWon', 'Duels won', 0.04136, 'All contested duels won'],
      ['duelsLost', 'Duels lost', -0.04773, 'All contested duels lost'],
      ['recoveries', 'Ball recoveries', 0.02864, 'Regaining an unpossessed ball'],
      ['dribbledPast', 'Dribbled past', -0.08273, 'Beaten by an opposing dribbler']
    ]},
    { id: 'discipline', title: 'Possession & discipline', short: 'Other', tint: '#ffd36d', description: 'Care of the ball, fouls and mistakes', events: [
      ['posLost', 'Dispossessed', -0.08909, 'An opponent takes the ball directly from you while you control it. Do not also record that turnover as a failed dribble, inaccurate pass or unsuccessful touch.'],
      ['badTouch', 'Unsuccessful touches', -0.06364, 'Turnovers caused by a poor first touch; do not also count as other possession lost'],
      ['foulsWon', 'Fouls won', 0.04455, 'Fouls drawn from opponents'],
      ['fouls', 'Fouls committed', -0.07, 'Fouls committed by player'],
      ['yellow', 'Yellow cards', -0.25455, 'Cautions received'],
      ['red', 'Red cards', -0.89091, 'Send-offs received'],
      ['errors', 'Errors leading to goal', -0.73182, 'Non-goalkeeper mistakes leading to opponent goals'],
      ['ownGoals', 'Own goals', -0.7, 'Goals scored into own net']
    ]},
    { id: 'goalkeeping', title: 'Goalkeeping', short: 'Keeper', tint: '#6bb7ff', description: 'Shot-stopping, control and distribution', events: [
      ['saves', 'Saves', 0.10818, 'Ordinary saves'],
      ['greatSaves', 'Exceptional saves', 0.17182, 'Additional bonus for outstanding saves; can overlap with saves'],
      ['conceded', 'Goals conceded', -0.12727, 'Opposing goals conceded while on court'],
      ['cleanSheet', 'Clean sheet', 0.22273, 'Set to 1 only for a complete qualifying clean sheet'],
      ['penSaved', 'Penalties saved', 0.7, 'Penalty shots saved'],
      ['claims', 'Successful claims', 0.06364, 'Crosses or dangerous balls securely claimed'],
      ['gkErrors', 'GK errors leading to goal', -0.73182, 'Goalkeeper mistakes leading to goals']
    ]}
  ];
  // Store the final V3 Beta indoor values directly; no runtime re-scaling.
  const EVENTS = GROUPS.flatMap(g => g.events.map(([key, label, weight, hint]) => ({key, label, weight, hint, group: g.id, tint: g.tint})));
  const BY_KEY = Object.fromEntries(EVENTS.map(event => [event.key, event]));
  const FACTORS = {
    forward: { attack: 1.12, passing: 1, defense: 0.90, discipline: 1, goalkeeping: 1 },
    midfielder: { attack: 1, passing: 1.10, defense: 1.03, discipline: 1, goalkeeping: 1 },
    defender: { attack: 0.95, passing: 1, defense: 1.13, discipline: 1, goalkeeping: 1 },
    keeper: { attack: 0.90, passing: 1, defense: 1, discipline: 1, goalkeeping: 1.25 }
  };
  const POSITION_KEYS = Object.freeze(['forward','midfielder','defender','keeper']);
  const DEFAULT_POSITION_SHARES = Object.freeze({forward:50, midfielder:0, defender:50, keeper:0});
  function cleanPositionShares(input) {
    const v = input && typeof input === 'object' ? input : DEFAULT_POSITION_SHARES;
    return Object.fromEntries(POSITION_KEYS.map(k => [k, Math.max(0, Math.min(100, Math.round(Number(v[k]) || 0)))]));
  }
  function positionShareTotal(input) {
    const v=cleanPositionShares(input);
    return POSITION_KEYS.reduce((sum,k)=>sum+v[k],0);
  }
  function positionFactors(position='midfielder', shares=null) {
    if (position !== 'mixed') return { ...(FACTORS[position] || FACTORS.midfielder) };
    const split=cleanPositionShares(shares);
    const sum=POSITION_KEYS.reduce((n,k)=>n+split[k],0);
    // Preview remains responsive if a user is partway through editing the percentages.
    // Saving and previewing a finished report require precisely 100%.
    if (!sum) return { attack:1, passing:1, defense:1, discipline:1, goalkeeping:1 };
    return Object.fromEntries(Object.keys(FACTORS.forward).map(category=>[
      category, POSITION_KEYS.reduce((n,k)=>n+split[k]*FACTORS[k][category],0)/sum
    ]));
  }
  const defaultStats = () => Object.fromEntries(EVENTS.map(e => [e.key, 0]));
  const defaultWeights = () => Object.fromEntries(EVENTS.map(e => [e.key, e.weight]));
  const number = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
  function cleanStats(stats) {
    return Object.fromEntries(EVENTS.map(e => [e.key, Math.max(0, Math.min(99999, Math.floor(number(stats && stats[e.key]))))]));
  }
  function cleanWeights(weights) {
    return Object.fromEntries(EVENTS.map(e => [e.key, Math.max(-10, Math.min(10, number(weights && weights[e.key], e.weight)))]));
  }
  const round = (v, decimals=2) => Number(v.toFixed(decimals));
  function calculate(stats, position='midfielder', inputWeights=null, positionShares=null) {
    stats = cleanStats(stats);
    const weights = cleanWeights(inputWeights || defaultWeights());
    const factors = positionFactors(position, positionShares);
    const impact = {};
    let net = 0;
    const groups = GROUPS.map(group => {
      let subtotal = 0;
      group.events.forEach(([key]) => {
        const points = stats[key] * weights[key] * factors[group.id];
        impact[key] = points;
        subtotal += points;
      });
      net += subtotal;
      return { ...group, subtotal };
    });
    const rawRating = Math.max(MIN, Math.min(MAX, BASE + net));
    const rating = round(rawRating, 1);
    const passAttempts = stats.passGood + stats.passBad;
    const duels = stats.duelsWon + stats.duelsLost;
    const dribbleAttempts = stats.dribbleWon + stats.dribbleLost;
    // Shot types are mutually exclusive; scored goals count as on-target attempts.
    // Missed clear/exceptional chances are separate off-target shot categories, not bonus deductions.
    const shotsOnTarget = stats.goals + stats.shotsOn;
    const shotsOffTarget = stats.shotsOff + stats.bigMisses + stats.exceptionalMiss;
    const shotAttempts = shotsOnTarget + shotsOffTarget + stats.shotBlocked;
    // Derived turnover total: each failure belongs to exactly one cause. 'posLost' is the legacy storage key for Dispossessed. Do not score the sum again.
    const totalPossessionLost = stats.passBad + stats.dribbleLost + stats.badTouch + stats.posLost;
    return {
      rating, rawRating, net, groups, impact, stats, weights, factors, positionShares: position === 'mixed' ? cleanPositionShares(positionShares) : null,
      passAttempts,
      passAccuracy: passAttempts ? round(100 * stats.passGood / passAttempts, 0) : null,
      dribbleAttempts,
      shotsOnTarget, shotsOffTarget, shotAttempts,
      shotAccuracy: shotAttempts ? round(100 * shotsOnTarget / shotAttempts, 0) : null,
      dribbleAccuracy: dribbleAttempts ? round(100 * stats.dribbleWon / dribbleAttempts, 0) : null,
      totalPossessionLost,
      duelRate: duels ? round(100 * stats.duelsWon / duels, 0) : null,
      goalContributions: stats.goals + stats.assists,
      totalActions: Object.values(stats).reduce((sum, n) => sum + n, 0),
      activeEvents: Object.values(stats).filter(v => v > 0).length,
      grade: rating >= 9 ? 'Outstanding' : rating >= 8 ? 'Excellent' : rating >= 7 ? 'Good' : rating >= 6 ? 'Average' : rating >= 5 ? 'Below average' : 'Poor'
    };
  }
  global.RatingEngine = Object.freeze({ GROUPS, EVENTS, BY_KEY, FACTORS, POSITION_KEYS, DEFAULT_POSITION_SHARES, positionFactors, cleanPositionShares, positionShareTotal, CALIBRATION, BASE, MIN, MAX, defaultStats, defaultWeights, cleanStats, cleanWeights, calculate });
})(window);
