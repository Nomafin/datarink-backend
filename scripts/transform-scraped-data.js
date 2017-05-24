/**
 * Exports transformData(pbpJson, shiftJson), a function used by scrape-games.js
 * Given the nhl's pbp and shift json data, transformData(...) returns
 * an object containing the rows to be inserted into database
 */

// Contexts and stats to record in output
const outScoreSits = [-3, -2, -1, 0, 1, 2, 3];
const outStrSits = ['ev5', 'ev4', 'ev3', 'pp54', 'pp53', 'pp43', 'sh45', 'sh35', 'sh34', 'penShot', 'noOwnG', 'noOppG', 'other'];
const outStats = ['toi', 'ig', 'is', 'ibs', 'ims', 'ia1', 'ia2', 'blocked', 'iOfoWon', 'iOfoLost', 'iDfoWon', 'iDfoLost', 'iNfoWon', 'iNfoLost', 'iPenTaken', 'iPenDrawn', 'iEffPenTaken', 'iEffPenDrawn', 'ihf', 'iha', 'iGive', 'iTake', 'gf', 'ga', 'sf', 'sa', 'bsf', 'bsa', 'msf', 'msa', 'otf', 'ofoWon', 'ofoLost', 'dfoWon', 'dfoLost', 'nfoWon', 'nfoLost', 'penTaken', 'penDrawn', 'effPenTaken', 'effPenDrawn', 'hf', 'ha', 'give', 'take', 'icingTaken', 'icingDrawn'];

// Return an object with initialized stats for combinations of strength and score situations
function initStats() {
  const obj = {};
  outStrSits.forEach((str) => {
    obj[str] = {};
    outScoreSits.forEach((sc) => {
      obj[str][sc] = {};
      outStats.forEach(stat => (obj[str][sc][stat] = 0));
    });
  });

  return obj;
}

/**
 * Given [awayScore, homeScore], return [awayScoreSit, homeScoreSit]
 * awayScoreSit and homeScoreSit: -3, -2, -1, 0, 1, 2, 3
 * Avoid returning -1 * 0 = -0 (return 0 instead)
 */
function getScoreSits(score) {
  const aScoreSit = Math.max(-3, Math.min(3, score[0] - score[1]));
  const returnArr = [aScoreSit];
  returnArr.push(aScoreSit === 0 ? 0 : -1 * aScoreSit);
  return returnArr;
}

/**
 * Given away/home goalie and skater counts, return [awayStrSit, homeStrSit]
 * counts: { goalies: [1, 1], skaters: [5, 5] }
 */
function getStrSits(counts) {
  let strSits = ['other', 'other'];
  if (counts.goalies[0] === 0 && counts.goalies[1] === 1) {
    strSits = ['noOwnG', 'noOppG'];
  } else if (counts.goalies[0] === 1 && counts.goalies[1] === 0) {
    strSits = ['noOppG', 'noOwnG'];
  } else if (Math.min(...counts.skaters) >= 3 && Math.max(...counts.skaters) <= 5) {
    if (counts.skaters[0] === counts.skaters[1]) {
      strSits = [`ev${counts.skaters[0]}`, `ev${counts.skaters[1]}`];
    } else if (counts.skaters[0] > counts.skaters[1]) {
      strSits = [`pp${counts.skaters[0]}${counts.skaters[1]}`, `sh${counts.skaters[1]}${counts.skaters[0]}`];
    } else if (counts.skaters[0] < counts.skaters[1]) {
      strSits = [`sh${counts.skaters[0]}${counts.skaters[1]}`, `pp${counts.skaters[1]}${counts.skaters[0]}`];
    }
  }

  return strSits;
}

// Convert a mm:ss string to seconds
function toSecs(mmss) {
  const arr = mmss.split(':').map(str => parseInt(str, 10));
  return (60 * arr[0]) + arr[1];
}

/**
 * Given all the shots in a period, return whether or not (true/false)
 * the x-coordinates for the home team's defensive zone is less than 0 for the period
 */
function isHomeDefZoneNegInPeriod(prdShots) {
  const shotsForBetterTeam = ['away', 'home']
    // Return [array of away shots, array of home shots]
    .map(ven => prdShots.filter(ev => ev.venue === ven))
    // Return array of shots for team who shot more in period
    .reduce((result, venShots) => (venShots.length > result.length ? venShots : result), []);

  // Calculate {number of shots with x > 0} - {number of shots with x < 0}
  const posXMinusNegX = shotsForBetterTeam.reduce((diff, shot) => {
    if (shot.locX === 0) {
      return diff;
    }
    return shot.locX < 0 ? diff - 1 : diff + 1;
  }, 0);

  return ((shotsForBetterTeam[0].venue === 'home' && posXMinusNegX > 0)
    || (shotsForBetterTeam[0].venue === 'away' && posXMinusNegX < 0));
}

/**
 * Convert an event's x-coordinate into the home team's zone (n, d, o)
 * Centre ice is at x = 0; red lines are at x = -25 and x = 25
 * isHomeDefZoneNeg: if the home team's defensive zone has a negative x-coordinate (true/false)
 * locX: the event's x-coordinate
 */
function getHomeZone(isHomeDefZoneNeg, locX) {
  let hZone;
  if (locX >= -25 && locX <= 25) {
    hZone = 'n';
  } else if ((isHomeDefZoneNeg && locX < -25) || (!isHomeDefZoneNeg && locX > 25)) {
    hZone = 'd';
  } else if ((isHomeDefZoneNeg && locX > 25) || (!isHomeDefZoneNeg && locX < -25)) {
    hZone = 'o';
  }

  return hZone;
}

/**
 * Given the pbp json events, return a new array of event objects
 * rawEvs: the array of plays in the pbp json
 * aId, hId: the away and home team ids (as integers)
 */
function createOutEvents(rawEvs, aId, hId) {
  const outEvents = rawEvs.map((rawEv) => {
    const outEv = {};
    outEv.id = rawEv.about.eventIdx;
    outEv.period = rawEv.about.period;
    outEv.time = toSecs(rawEv.about.periodTime);
    outEv.description = rawEv.result.description;
    outEv.type = rawEv.result.eventTypeId.toLowerCase();
    outEv.subtype = Object.prototype.hasOwnProperty.call(rawEv.result, 'secondaryType')
      ? rawEv.result.secondaryType.toLowerCase() : '';

    // periodType values: regular, overtime, shootout
    outEv.periodType = rawEv.about.periodType.toLowerCase();

    // Store penalty information
    if (outEv.type === 'penalty') {
      outEv.penSeverity = rawEv.result.penaltySeverity.toLowerCase();
      outEv.penMins = rawEv.result.penaltyMinutes;
    }

    // Store location information
    if (Object.prototype.hasOwnProperty.call(rawEv, 'coordinates')
      && Object.prototype.hasOwnProperty.call(rawEv.coordinates, 'x')
      && Object.prototype.hasOwnProperty.call(rawEv.coordinates, 'y')) {
      outEv.locX = rawEv.coordinates.x;
      outEv.locY = rawEv.coordinates.y;
    }

    /*
     * Store players and their roles
     * For goals, the json gives all assisters the 'assist' role
     * Enhance this to 'assist1' and 'assist2', assuming the json is [scorer, assist1, assist2]
     * For giveaways and takeaways, only the giver or taker is listed, and their role is 'playerid'
     * Convert these roles to 'giver' and 'taker'
     */
    if (Object.prototype.hasOwnProperty.call(rawEv, 'players')) {
      outEv.roles = rawEv.players.map((p, i) => {
        let role = p.playerType.toLowerCase();
        if (outEv.type === 'goal' && role === 'assist') {
          role += i;
        } else if (['giveaway', 'takeaway'].includes(outEv.type) && role === 'playerid') {
          role = `${outEv.type.substring(0, 4)}r`;
        }

        return {
          player: p.player.id,
          role,
        };
      });
    }

    /**
     * Attribute event to a team
     * The json attributes blocked shots to the blocker's team, but we attribute it to the shooter
     */
    if (Object.prototype.hasOwnProperty.call(rawEv, 'team')) {
      outEv.team = rawEv.team.id;
      outEv.venue = outEv.team === aId ? 'away' : 'home';
      if (outEv.type === 'blocked_shot') {
        outEv.venue = outEv.venue === 'away' ? 'home' : 'away';
        outEv.team = outEv.team === aId ? hId : aId;
      }
    }

    /**
     * Store the home and away scores when the event occurred
     * The json does not include SO goals in the 'score' property
     * For non-SO goals, the json includes the goal itself, but it's more accurate to exclude it
     * For example, the first non-SO goal occurred when the score was 0-0
     */
    outEv.score = [rawEv.about.goals.away, rawEv.about.goals.home];
    if (outEv.periodType !== 'shootout' && outEv.type === 'goal') {
      if (outEv.venue === 'away') {
        outEv.score[0] -= 1;
      } else if (outEv.venue === 'home') {
        outEv.score[1] -= 1;
      }
    }

    // For non-shootout events, store score situations
    if (outEv.periodType !== 'shootout') {
      outEv.scoreSits = getScoreSits(outEv.score);
    }

    return outEv;
  });

  /**
   * Flag penalty shots by looping through events
   * If a penalty with severity 'penalty shot' is found, find the next shot and flag it
   */
  let searchForPenaltyShot = false;
  outEvents.forEach((outEv) => {
    if (outEv.type === 'penalty' && outEv.penSeverity === 'penalty shot') {
      searchForPenaltyShot = true;
    } else if (searchForPenaltyShot
      && ['goal', 'shot', 'missed_shot', 'blocked_shot'].includes(outEv.type)) {
      searchForPenaltyShot = false;
      outEv.isPenShot = true;
    }
  });

  /**
   * Flag whether each penalty was 'effective' (i.e., gave the drawing team an advantage)
   * Ineffective: coincidental penalties (including fights) and misconducts
   * Fight example: 2016020410
   * Misconduct example, where no other penalties were called: 2016020840
   * Misconduct example, where offending player also took a major: 2016021076
   */
  const penEvs = outEvents.filter(outEv => outEv.type === 'penalty');
  penEvs.forEach((pen1) => {
    pen1.isEffective = true;

    /**
     * Flag coincidental penalties as being ineffective:
     * Check if the player who drew pen1 also took an equally severe penalty (pen2) at the same time
     * Some penalties do not have a 'drewby' player
     */
    if (pen1.roles.find(r => r.role === 'drewby')) {
      const drewBy = pen1.roles.find(r => r.role === 'drewby').player;
      const coincidental = penEvs
        .filter(pen2 => pen2.period === pen1.period && pen2.time === pen1.time
          && pen1.penSeverity === pen2.penSeverity)
        .find((pen2) => {
          const penaltyOn = pen2.roles.find(r => r.role === 'penaltyon').player;
          return penaltyOn === drewBy;
        });
      if (coincidental) {
        pen1.isEffective = false;
      }
    }

    // Flag misconducts as being ineffective
    if (pen1.penSeverity.toLowerCase().includes('misconduct')) {
      pen1.isEffective = false;
    }
  });

  return outEvents;
}

// Export function for transforming scraped data
module.exports.transformData = function transformData(pbpJson, shiftJson) {
  // Skip games that aren't final
  if (pbpJson.gameData.status.abstractGameState.toLowerCase() !== 'final') {
    return {};
  }

  const gid = pbpJson.gamePk;

  // Store events for output
  const outEvents =
    createOutEvents(pbpJson.liveData.plays.allPlays,
      pbpJson.gameData.teams.away.id,
      pbpJson.gameData.teams.home.id);

  /**
   * Store each period's duration and type
   * period: 1, 2, 3, 4...
   * duration: period length in seconds
   * type: regular, overtime, shootout
   */
  const periods = [];
  outEvents.filter(ev => ev.type === 'period_end')
    .forEach((ev) => {
      /**
       * Some games have 2 period_end events listed for a single period
       * However, we only want a single 'periods' element per period
       */
      if (!periods.find(p => p.period === ev.period)) {
        periods.push({
          period: ev.period,
          duration: ev.time,
          type: ev.periodType.toLowerCase(),
        });
      }
    });

  // Fix games that have missing or inaccurate period_end events
  if ([2015020904, 2014021118, 2013020083, 2013020274, 2013020644, 2013020868]
    .includes(gid)) {
    periods.push({
      period: 4,
      duration: 300,
      type: 'overtime',
    });
  } else if ([2015021188, 2014020833, 2014020886, 2013020115, 2012020179, 2011020259]
    .includes(gid)) {
    periods.find(prd => prd.period === 4).duration = 300;
  } else if ([2014030231].includes(gid)) {
    periods.find(prd => prd.period === 1).duration = 1200;
  } else if ([2012020288].includes(gid)) {
    periods.find(prd => prd.period === 3).duration = 1200;
  }

  periods.sort((a, b) => a.period - b.period);

  /**
   * Set periods' isHomeDefZoneNeg property for non-shootout periods
   * Whether or not (true/false) the home team's defensive zone had x-coordinates < 0
   */
  periods.filter(prd => prd.type !== 'shootout')
    .forEach((prd) => {
      const prdShots = outEvents.filter(ev => (ev.period === prd.period
        && ['goal', 'shot', 'missed_shot', 'blocked_shot'].includes(ev.type)));
      prd.isHomeDefZoneNeg = isHomeDefZoneNegInPeriod(prdShots);
    });

  /**
   * Correct periods' isHomeDefZoneNeg property for games where teams switched ends mid-period
   * For these periods, use isHomeDefZoneNeg to reflect the first half of periods
   */
  const isHomeDefZoneNegFix = {
    2013020610: {
      3: true,
      4: false,
    },
    2010020566: {
      3: false,
    },
  };
  if (Object.prototype.hasOwnProperty.call(isHomeDefZoneNegFix, gid)) {
    Object.keys(isHomeDefZoneNegFix[gid]).forEach((fixPrd) => {
      periods.find(prd => prd.period === parseInt(fixPrd, 10)).isHomeDefZoneNeg =
        isHomeDefZoneNegFix[gid][fixPrd];
    });
  }

  /**
   * Append home and away teams' zones (n, d, o) and defSides to non-shootout events in outEvents
   * defSides is [1, -1] if the home team's defensive zone has negative x values
   * defSides is [-1, 1] if the home team's defnesive zone has positive x values
   */
  const flipZone = {
    o: 'd',
    d: 'o',
    n: 'n',
  };
  outEvents.filter(ev => (Object.prototype.hasOwnProperty.call(ev, 'locX') && ev.periodType !== 'shootout'))
    .forEach((ev) => {
      const evPeriod = periods.find(prd => prd.period === ev.period);
      ev.defSides = evPeriod.isHomeDefZoneNeg ? [1, -1] : [-1, 1];
      const hZone = getHomeZone(evPeriod.isHomeDefZoneNeg, ev.locX);
      ev.zones = [flipZone[hZone], hZone];
    });

  /**
   * For games where teams switched ends mid-period,
   * correct events' zone values and side values for the second half of the periods
   */
  if (Object.prototype.hasOwnProperty.call(isHomeDefZoneNegFix, gid)) {
    Object.keys(isHomeDefZoneNegFix[gid]).forEach((key) => {
      const fixPrd = parseInt(key, 10);
      const prdDuration = periods.find(prd => prd.period === fixPrd).duration;
      const secondHalfEvs =
        outEvents.filter(ev => (Object.prototype.hasOwnProperty.call(ev, 'zones')
          && ev.period === fixPrd
          && ev.time > prdDuration / 2));
      secondHalfEvs.forEach((ev) => {
        ev.defSides.reverse();
        ev.zones.reverse();
      });
    });
  }

  /**
   * Initialize variables for storing results
   * outPlayers: an associative array of player objects, using player ids as keys
   * outTeams: an associate array of team objects
   */
  const outPlayers = {};
  const outTeams = {
    away: {},
    home: {},
  };

  // Initialize team results
  Object.keys(outTeams).forEach((venue) => {
    outTeams[venue] = initStats();
    outTeams[venue].id = pbpJson.gameData.teams[venue].id;
    outTeams[venue].name = pbpJson.gameData.teams[venue].name;
    outTeams[venue].abbreviation = pbpJson.gameData.teams[venue].abbreviation.toLowerCase();
  });

  // Initialize player results
  const rawPlayers = pbpJson.gameData.players;
  const rawTeams = pbpJson.liveData.boxscore.teams;
  Object.keys(rawPlayers).forEach((key) => {
    const pid = rawPlayers[key].id;
    outPlayers[pid] = initStats();

    /**
     * Store player metadata. Scratched players have position 'n/a' - replace this with 'na',
     * and occasionally don't have a jerseyNumber property
     */
    const playerVenue = Object.prototype.hasOwnProperty.call(rawTeams.away.players, key)
      ? 'away' : 'home';
    outPlayers[pid].first = rawPlayers[key].firstName;
    outPlayers[pid].last = rawPlayers[key].lastName;
    outPlayers[pid].venue = playerVenue;
    outPlayers[pid].team = outTeams[playerVenue].id;
    outPlayers[pid].position = rawTeams[playerVenue].players[key].position.code
      .toLowerCase().replace('/', '');
    if (Object.hasOwnProperty.call(rawTeams[playerVenue].players[key], 'jerseyNumber')) {
      outPlayers[pid].jersey = parseInt(rawTeams[playerVenue].players[key].jerseyNumber, 10);
    }
  });

  /**
   * Record offending team for icing events
   * Find the next faceoff and use the zone to determine the offending team
   */
  let stoppage;
  outEvents.forEach((outEv) => {
    if (outEv.type === 'stop' && outEv.description.toLowerCase() === 'icing') {
      stoppage = outEv;
    } else if (stoppage && outEv.type === 'faceoff') {
      stoppage.venue = outEv.zones[0] === 'd' ? 'away' : 'home';
      stoppage.team = outTeams[stoppage.venue].id;
      stoppage = null;
    }
  });

  /**
   * Store player shifts - skip raw shift data for players not in outPlayers
   * In 2016020107, Schneider has shifts in the shift json, but isn't in the pbp or box score
   */
  const outShifts = shiftJson.data
    .filter(sh => Object.prototype.hasOwnProperty.call(outPlayers, sh.playerId))
    .map(sh => ({
      pid: sh.playerId,
      team: sh.teamId,
      venue: sh.teamId === outTeams.away.id ? 'away' : 'home',
      period: sh.period,
      start: toSecs(sh.startTime),
      end: toSecs(sh.endTime),
    }))
    // Only keep shifts where the end time is after the start time
    .filter(sh => sh.start < sh.end)
    // Remove shootout shifts
    .filter(sh => periods.find(p => p.period === sh.period).type !== 'shootout');

  // Initialize objects to store information about each 1-second interval
  const intervals = periods.reduce((result, prd) => {
    const prdIntervals = [];
    for (let t = 0; t < prd.duration; t += 1) {
      prdIntervals.push({
        period: prd.period,
        start: t,
        end: t + 1,
        goalies: [[], []],
        skaters: [[], []],
        strSits: ['', ''],
        score: [0, 0],
        scoreSits: ['', ''],
      });
    }

    return result.concat(prdIntervals);
  }, []);

  // Add on-ice skaters and goalies to intervals
  outShifts.forEach((sh) => {
    const venIdx = sh.venue === 'away' ? 0 : 1;
    const posToUpdate = outPlayers[sh.pid].position === 'g' ? 'goalies' : 'skaters';
    intervals.filter(d => d.period === sh.period && d.start >= sh.start && d.end <= sh.end)
      .forEach((d) => {
        /**
         * In 2015030143, player 8471724 had 2 shift entries that overlap
         * Avoid recording the same player multiple times
         */
        if (!d[posToUpdate][venIdx].includes(sh.pid)) {
          d[posToUpdate][venIdx].push(sh.pid);
        }
      });
  });

  /**
   * Increment score for intervals after each goal
   * Goal @ 0:00: increment interval 0:00-0:01 and onwards
   * Goal @ 0:01: increment interval 0:01-0:02 and onwards
   * Goal @ 0:20 and period duration = 0:20: no intervals to increment
   */
  outEvents.filter(ev => ev.type === 'goal')
    .forEach((ev) => {
      const venIdx = ev.venue === 'away' ? 0 : 1;
      intervals.filter(d => d.period > ev.period || (d.period === ev.period && d.start >= ev.time))
        .forEach(d => (d.score[venIdx] += 1));
    });

  // Add strength and score situation to intervals
  intervals.forEach((d) => {
    d.scoreSits = getScoreSits(d.score);
    d.strSits = getStrSits({
      goalies: [d.goalies[0].length, d.goalies[1].length],
      skaters: [d.skaters[0].length, d.skaters[1].length],
    });
  });

  // Increment teams' toi for each strength and score situation combination
  intervals.forEach((d) => {
    outTeams.away[d.strSits[0]][d.scoreSits[0]].toi += 1;
    outTeams.home[d.strSits[1]][d.scoreSits[1]].toi += 1;
  });

  // Increment players' toi for each strength and score situation combination
  Object.keys(outPlayers).forEach((pid) => {
    const venIdx = outPlayers[pid].venue === 'away' ? 0 : 1;
    const playerIntervals = intervals.filter(d =>
      d.skaters[venIdx].concat(d.goalies[venIdx])
        .includes(parseInt(pid, 10)));
    playerIntervals.forEach(d =>
      (outPlayers[pid][d.strSits[venIdx]][d.scoreSits[venIdx]].toi += 1));
  });

  /**
   * For non-shootout events, append: on-ice players, strength situations
   * For shootout events, leave these properties undefined
   */
  outEvents.filter(ev => ev.periodType !== 'shootout')
    .forEach((ev) => {
      let interval;
      if (ev.time === 0) {
        // Events at period start. Includes: game_scheduled, period_start, period_ready
        interval = intervals.find(d => d.period === ev.period && d.start === ev.time);
      } else if (ev.time === periods.find(prd => prd.period === ev.period).duration) {
        // Events at period end. Includes: period_official, period_end, game_end, overtime goals
        interval = intervals.find(d => d.period === ev.period && d.end === ev.time);
      } else if (ev.type === 'faceoff') {
        // Attribute a faceoff @ 0:05 to players on ice during interval 0:05-0:06
        interval = intervals.find(d => d.period === ev.period && d.start === ev.time);
      } else {
        // Attribute a shot @ 0:05 to players on ice during interval 0:04-0:05
        interval = intervals.find(d => d.period === ev.period && d.end === ev.time);
      }
      ev.skaters = interval.skaters;
      ev.goalies = interval.goalies;
      ev.strSits = ev.isPenShot ? ['penShot', 'penShot'] : interval.strSits;
    });

  /**
   * Increment on-ice stats for teams and players
   * Exclude shootout events, and events whose type is not defined in statAbbrevs (and is not icing)
   */
  const statAbbrevs = {
    goal: 'g',
    shot: 's',
    blocked_shot: 'bs',
    missed_shot: 'ms',
    faceoff: 'fo',
    penalty: 'pen',
    hit: 'h',
    takeaway: 'take',
    giveaway: 'give',
  };
  outEvents.filter(ev =>
      ev.periodType !== 'shootout'
      && (
        Object.prototype.hasOwnProperty.call(statAbbrevs, ev.type)
        || (ev.type === 'stop' && ev.description.toLowerCase() === 'icing')
      ))
    .forEach((ev) => {
      /**
       * Get the prefixes and suffixes for the away and home teams
       * 'prefixes' indicate faceoff zones: o/d/n
       * 'suffixes' indicate if shot was for/against, faceoff was won/lost, penalty was taken/drawn
       */
      let prefixes = ['', ''];
      let suffixes = ['', ''];
      if (['goal', 'shot', 'missed_shot', 'blocked_shot', 'hit'].includes(ev.type)) {
        suffixes = ev.venue === 'away' ? ['f', 'a'] : ['a', 'f'];
      } else if (ev.type === 'penalty') {
        suffixes = ev.venue === 'away' ? ['Taken', 'Drawn'] : ['Drawn', 'Taken'];
      } else if (ev.type === 'faceoff') {
        suffixes = ev.venue === 'away' ? ['Won', 'Lost'] : ['Lost', 'Won'];
        prefixes = ev.zones;
      } else if (ev.type === 'stop' && ev.description.toLowerCase() === 'icing') {
        suffixes = ev.venue === 'away' ? ['Taken', 'Drawn'] : ['Drawn', 'Taken'];
      }

      /**
       * Increment stats for away and home teams and players
       * For goals, also increment shots
       * For penalties, also increment effective penalties counter
       */
      Object.keys(outTeams).forEach((venue) => {
        const venIdx = venue === 'away' ? 0 : 1;
        const strSitToUpdate = ev.strSits[venIdx];
        const scoreSitToUpdate = ev.scoreSits[venIdx];
        const playersToUpdate = ev.skaters[venIdx].concat(ev.goalies[venIdx]);
        const statsToUpdate = ev.type === 'stop' && ev.description.toLowerCase() === 'icing' ?
          [`icing${suffixes[venIdx]}`] :
          [`${prefixes[venIdx]}${statAbbrevs[ev.type]}${suffixes[venIdx]}`];
        if (ev.type === 'goal') {
          statsToUpdate.push(`${prefixes[venIdx]}s${suffixes[venIdx]}`);
        } else if (ev.type === 'penalty' && ev.isEffective) {
          statsToUpdate.push(`effPen${suffixes[venIdx]}`);
        }

        statsToUpdate.forEach((stat) => {
          outTeams[venue][strSitToUpdate][scoreSitToUpdate][stat] += 1;
          playersToUpdate.forEach((pid) => {
            outPlayers[pid][strSitToUpdate][scoreSitToUpdate][stat] += 1;
          });
        });
      });
    });

  /**
   * Increment players' individual stats
   * Exclude shootout events
   */
  outEvents.filter(ev =>
      ev.periodType !== 'shootout' && Object.prototype.hasOwnProperty.call(ev, 'roles'))
    .forEach((ev) => {
      ev.roles.forEach((player) => {
        /**
         * In 2015020862, player 8474636 served their coach's game misconduct,
         * but the player does not exist anywhere else in the pbp json
         */
        if (!outPlayers[player.player]) {
          return;
        }

        const venIdx = outPlayers[player.player].venue === 'away' ? 0 : 1;

        // Translate role to stats
        let statsToUpdate = [];
        if (player.role === 'winner') {
          statsToUpdate = [`i${ev.zones[venIdx].toUpperCase()}foWon`];
        } else if (player.role === 'loser') {
          statsToUpdate = [`i${ev.zones[venIdx].toUpperCase()}foLost`];
        } else if (player.role === 'blocker') {
          statsToUpdate = ['blocked'];
        } else if (player.role === 'scorer') {
          statsToUpdate = ['ig', 'is'];
        } else if (player.role === 'assist1') {
          statsToUpdate = ['ia1'];
        } else if (player.role === 'assist2') {
          statsToUpdate = ['ia2'];
        } else if (player.role === 'hitter') {
          statsToUpdate = ['ihf'];
        } else if (player.role === 'hittee') {
          statsToUpdate = ['iha'];
        } else if (player.role === 'giver') {
          statsToUpdate = ['iGive'];
        } else if (player.role === 'taker') {
          statsToUpdate = ['iTake'];
        } else if (player.role === 'penaltyon') {
          statsToUpdate = ['iPenTaken'];
          if (ev.isEffective) {
            statsToUpdate.push('iEffPenTaken');
          }
        } else if (player.role === 'drewby') {
          statsToUpdate = ['iPenDrawn'];
          if (ev.isEffective) {
            statsToUpdate.push('iEffPenDrawn');
          }
        } else if (player.role === 'shooter') {
          if (ev.type === 'shot') {
            statsToUpdate = ['is'];
          } else if (ev.type === 'blocked_shot') {
            statsToUpdate = ['ibs'];
          } else if (ev.type === 'missed_shot') {
            statsToUpdate = ['ims'];
          }
        }

        statsToUpdate.forEach(stat => (
          outPlayers[player.player][ev.strSits[venIdx]][ev.scoreSits[venIdx]][stat] += 1
        ));
      });
    });

  /**
   * Increment players' otf shifts, defined as:
   * shifts with start times that don't coincide with a faceoff
   */
  Object.keys(outPlayers).forEach((key) => {
    const pid = parseInt(key, 10);
    const otfShifts = outShifts.filter(sh => (
      sh.pid === pid
      && !outEvents.find(ev => ev.type === 'faceoff'
        && ev.period === sh.period
        && ev.time === sh.start)));

    // Increment otf for the corresponding strength and score situation
    const venIdx = outPlayers[pid].venue === 'away' ? 0 : 1;
    otfShifts.forEach((sh) => {
      const interval = intervals.find(d => (d.period === sh.period && d.start === sh.start));
      outPlayers[pid][interval.strSits[venIdx]][interval.scoreSits[venIdx]].otf += 1;
    });
  });

  /**
   * Create resultForDb, an object whose property names match db tables
   * For each table, create an array of row objects whose property names match db columns
   */
  const resultForDb = {};

  // Create rows for games table - game_date is in UTC
  resultForDb.games = [{
    game_id: gid,
    season: parseInt(gid.toString().substring(0, 4), 10),
    game_date: new Date(pbpJson.gameData.datetime.dateTime),
    periods: periods.reduce((max, cur) => (cur.period > max ? cur.period : max), 0),
    has_shootout: !!periods.find(prd => prd.type === 'shootout'),
    is_playoff: gid > 30000,
  }];

  // Create rows for game_teams table - 'score' includes shootout result
  resultForDb.game_teams = Object.keys(outTeams).map(venue => ({
    venue,
    game_id: gid,
    team_id: outTeams[venue].id,
    score: pbpJson.liveData.linescore.teams[venue].goals,
  }));

  // Create rows for game_team_stats table
  resultForDb.game_team_stats = [];
  Object.keys(outTeams).forEach((venue) => {
    outStrSits.forEach((strSit) => {
      outScoreSits.forEach((scoreSit) => {
        const row = {
          game_id: gid,
          team_id: outTeams[venue].id,
          strength_sit: strSit,
          score_sit: parseInt(scoreSit, 10),
          toi: outTeams[venue][strSit][scoreSit].toi,
          gf: outTeams[venue][strSit][scoreSit].gf,
          ga: outTeams[venue][strSit][scoreSit].ga,
          sf: outTeams[venue][strSit][scoreSit].sf,
          sa: outTeams[venue][strSit][scoreSit].sa,
          bsf: outTeams[venue][strSit][scoreSit].bsf,
          bsa: outTeams[venue][strSit][scoreSit].bsa,
          msf: outTeams[venue][strSit][scoreSit].msf,
          msa: outTeams[venue][strSit][scoreSit].msa,
          ofo_won: outTeams[venue][strSit][scoreSit].ofoWon,
          ofo_lost: outTeams[venue][strSit][scoreSit].ofoLost,
          dfo_won: outTeams[venue][strSit][scoreSit].dfoWon,
          dfo_lost: outTeams[venue][strSit][scoreSit].dfoLost,
          nfo_won: outTeams[venue][strSit][scoreSit].nfoWon,
          nfo_lost: outTeams[venue][strSit][scoreSit].nfoLost,
          pen_taken: outTeams[venue][strSit][scoreSit].penDrawn,
          pen_drawn: outTeams[venue][strSit][scoreSit].penTaken,
          eff_pen_taken: outTeams[venue][strSit][scoreSit].effPenDrawn,
          eff_pen_drawn: outTeams[venue][strSit][scoreSit].effPenTaken,
          hf: outTeams[venue][strSit][scoreSit].hf,
          ha: outTeams[venue][strSit][scoreSit].ha,
          give: outTeams[venue][strSit][scoreSit].give,
          take: outTeams[venue][strSit][scoreSit].take,
          icing_taken: outTeams[venue][strSit][scoreSit].icingTaken,
          icing_drawn: outTeams[venue][strSit][scoreSit].icingDrawn,
        };

        // Only record rows with at least 1 non-zero value
        let rowSum = 0;
        Object.keys(row)
          .filter(prop => !['game_id', 'team', 'strength_sit', 'score_sit'].includes(prop))
          .forEach(prop => (rowSum += row[prop]));
        if (rowSum > 0) {
          resultForDb.game_team_stats.push(row);
        }
      });
    });
  });

  // Create rows for teams table
  resultForDb.teams = Object.keys(outTeams).map(venue => ({
    team_id: outTeams[venue].id,
    abbreviation: outTeams[venue].abbreviation,
    team_name: outTeams[venue].name,
  }));

  // Create rows for players table
  resultForDb.players = Object.keys(outPlayers).map(pid => ({
    player_id: parseInt(pid, 10),
    first_name: outPlayers[pid].first,
    last_name: outPlayers[pid].last,
  }));

  // Create rows for game_players table
  resultForDb.game_players = Object.keys(outPlayers).map(pid => ({
    game_id: gid,
    player_id: parseInt(pid, 10),
    team_id: outPlayers[pid].team,
    jersey: outPlayers[pid].jersey,
    position: outPlayers[pid].position,
  }));

  // Create rows for game_player_stats table
  resultForDb.game_player_stats = [];
  Object.keys(outPlayers).forEach((pid) => {
    outStrSits.forEach((strSit) => {
      outScoreSits.forEach((scoreSit) => {
        const row = {
          game_id: gid,
          player_id: pid,
          strength_sit: strSit,
          score_sit: parseInt(scoreSit, 10),
          toi: outPlayers[pid][strSit][scoreSit].toi,
          ig: outPlayers[pid][strSit][scoreSit].ig,
          isog: outPlayers[pid][strSit][scoreSit].is,
          ibs: outPlayers[pid][strSit][scoreSit].ibs,
          ims: outPlayers[pid][strSit][scoreSit].ims,
          ia1: outPlayers[pid][strSit][scoreSit].ia1,
          ia2: outPlayers[pid][strSit][scoreSit].ia2,
          i_blocked: outPlayers[pid][strSit][scoreSit].blocked,
          i_ofo_won: outPlayers[pid][strSit][scoreSit].iOfoWon,
          i_ofo_lost: outPlayers[pid][strSit][scoreSit].iOfoLost,
          i_dfo_won: outPlayers[pid][strSit][scoreSit].iDfoWon,
          i_dfo_lost: outPlayers[pid][strSit][scoreSit].iDfoLost,
          i_nfo_won: outPlayers[pid][strSit][scoreSit].iNfoWon,
          i_nfo_lost: outPlayers[pid][strSit][scoreSit].iNfoLost,
          i_otf: outPlayers[pid][strSit][scoreSit].otf,
          i_pen_taken: outPlayers[pid][strSit][scoreSit].iPenTaken,
          i_pen_drawn: outPlayers[pid][strSit][scoreSit].iPenDrawn,
          i_eff_pen_taken: outPlayers[pid][strSit][scoreSit].iEffPenTaken,
          i_eff_pen_drawn: outPlayers[pid][strSit][scoreSit].iEffPenDrawn,
          ihf: outPlayers[pid][strSit][scoreSit].ihf,
          iha: outPlayers[pid][strSit][scoreSit].iha,
          i_give: outPlayers[pid][strSit][scoreSit].iGive,
          i_take: outPlayers[pid][strSit][scoreSit].iTake,

          // On-ice stats
          gf: outPlayers[pid][strSit][scoreSit].gf,
          ga: outPlayers[pid][strSit][scoreSit].ga,
          sf: outPlayers[pid][strSit][scoreSit].sf,
          sa: outPlayers[pid][strSit][scoreSit].sa,
          bsf: outPlayers[pid][strSit][scoreSit].bsf,
          bsa: outPlayers[pid][strSit][scoreSit].bsa,
          msf: outPlayers[pid][strSit][scoreSit].msf,
          msa: outPlayers[pid][strSit][scoreSit].msa,
          ofo_won: outPlayers[pid][strSit][scoreSit].ofoWon,
          ofo_lost: outPlayers[pid][strSit][scoreSit].ofoLost,
          dfo_won: outPlayers[pid][strSit][scoreSit].dfoWon,
          dfo_lost: outPlayers[pid][strSit][scoreSit].dfoLost,
          nfo_won: outPlayers[pid][strSit][scoreSit].nfoWon,
          nfo_lost: outPlayers[pid][strSit][scoreSit].nfoLost,
          pen_taken: outPlayers[pid][strSit][scoreSit].penDrawn,
          pen_drawn: outPlayers[pid][strSit][scoreSit].penTaken,
          eff_pen_taken: outPlayers[pid][strSit][scoreSit].effPenDrawn,
          eff_pen_drawn: outPlayers[pid][strSit][scoreSit].effPenTaken,
          hf: outPlayers[pid][strSit][scoreSit].hf,
          ha: outPlayers[pid][strSit][scoreSit].ha,
          give: outPlayers[pid][strSit][scoreSit].give,
          take: outPlayers[pid][strSit][scoreSit].take,
          icing_taken: outPlayers[pid][strSit][scoreSit].icingTaken,
          icing_drawn: outPlayers[pid][strSit][scoreSit].icingDrawn,
        };

        // Only record rows with at least 1 non-zero value
        let rowSum = 0;
        Object.keys(row)
          .filter(prop => !['game_id', 'player_id', 'strength_sit', 'score_sit'].includes(prop))
          .forEach(prop => (rowSum += row[prop]));
        if (rowSum > 0) {
          resultForDb.game_player_stats.push(row);
        }
      });
    });
  });

  // Create rows for game_events table
  resultForDb.game_events = outEvents.map(ev => ({
    game_id: gid,
    event_id: ev.id,
    period: ev.period,
    period_type: ev.periodType,
    event_time: ev.time,
    event_desc: ev.description,
    event_type: ev.type,
    event_subtype: ev.subtype,
    pen_severity: ev.type === 'penalty' ? ev.penSeverity : null,
    pen_mins: ev.type === 'penalty' ? ev.penMins : null,
    pen_is_effective: ev.type === 'penalty' ? ev.isEffective : null,
    team_id: ev.team,
    venue: ev.venue,
    loc_x: ev.locX,
    loc_y: ev.locY,
    a_zone: ev.zones ? ev.zones[0] : null,
    h_zone: ev.zones ? ev.zones[1] : null,
    a_def_side: ev.defSides ? ev.defSides[0] : null,
    h_def_side: ev.defSides ? ev.defSides[1] : null,
    a_strength_sit: ev.strSits ? ev.strSits[0] : null,
    h_strength_sit: ev.strSits ? ev.strSits[1] : null,
    a_score: ev.score ? ev.score[0] : null,
    h_score: ev.score ? ev.score[1] : null,
    a_score_sit: ev.scoreSits ? ev.scoreSits[0] : null,
    h_score_sit: ev.scoreSits ? ev.scoreSits[1] : null,
    a_skaters: ev.skaters ? ev.skaters[0].length : null,
    h_skaters: ev.skaters ? ev.skaters[1].length : null,
    a_goalies: ev.goalies ? ev.goalies[0].length : null,
    h_goalies: ev.goalies ? ev.goalies[1].length : null,
  }));

  // Create rows for game_event_players table - exclude shootout events
  resultForDb.game_event_players = [];
  outEvents.filter(ev => ev.periodType !== 'shootout')
    .forEach((ev) => {
      const evRows = [];

      // Store on-ice skaters and goalies
      ev.skaters[0].concat(ev.skaters[1], ev.goalies[0], ev.goalies[1])
        .forEach((pid) => {
          evRows.push({
            game_id: gid,
            event_id: ev.id,
            player_id: pid,
            on_ice: true,
          });
        });

      // Store roles
      if (Object.prototype.hasOwnProperty.call(ev, 'roles')) {
        ev.roles.forEach((r) => {
          const existingRow = evRows.find(d => d.player_id === r.player);
          if (existingRow) {
            existingRow.role = r.role;
          } else {
            evRows.push({
              game_id: gid,
              event_id: ev.id,
              player_id: r.player,
              on_ice: false,
              role: r.role,
            });
          }
        });
      }

      resultForDb.game_event_players = resultForDb.game_event_players.concat(evRows);
    });

  // Create rows for game_shifts table
  resultForDb.game_shifts = [];
  Object.keys(outPlayers).forEach((key) => {
    const pid = parseInt(key, 10);
    periods.forEach((prd) => {
      const shifts = outShifts.filter(sh => (sh.pid === pid && sh.period === prd.period));
      if (shifts.length === 0) {
        return;
      }

      resultForDb.game_shifts.push({
        game_id: gid,
        player_id: pid,
        period: prd.period,
        shifts: shifts.sort((a, b) => a.start - b.start)
          .map(sh => [sh.start, sh.end]),
      });
    });
  });

  // Create rows for game_situations table
  resultForDb.game_situations = [];
  Object.keys(outTeams).forEach((venue) => {
    const venIdx = venue === 'away' ? 0 : 1;
    outStrSits.forEach((strSit) => {
      outScoreSits.forEach((scoreKey) => {
        periods.forEach((prd) => {
          const scoreSit = parseInt(scoreKey, 10);
          const prdIntervals = intervals
            .filter(d => (
              d.period === prd.period
              && d.strSits[venIdx] === strSit
              && d.scoreSits[venIdx] === scoreSit
            ))
            .sort((a, b) => a.start - b.start);

          // Create an array of [start of situation, end of situation] pairs
          const timeranges = [];
          let curRangeStart;
          prdIntervals.forEach((d, i) => {
            if (i > 0 && i < prdIntervals.length - 1 && d.start !== prdIntervals[i - 1].end) {
              // If current interval does not immediately follow the previous, create timerange
              timeranges.push([curRangeStart, prdIntervals[i - 1].end]);
              curRangeStart = d.start;
            } else {
              // Record start time for a timerange at the first interval
              if (i === 0) {
                curRangeStart = d.start;
              }

              // Create a timerange at the last interval (which could also be the first interval)
              if (i === prdIntervals.length - 1) {
                timeranges.push([curRangeStart, d.end]);
              }
            }
          });

          if (timeranges.length > 0) {
            resultForDb.game_situations.push({
              timeranges,
              game_id: gid,
              team_id: outTeams[venue].id,
              strength_sit: strSit,
              score_sit: scoreSit,
              period: prd.period,
            });
          }
        });
      });
    });
  });

  return resultForDb;
};
