/**
 * Full 2026 F1 World Championship Calendar
 * Sessions times are in UTC.
 * hasSprint: true means the weekend includes a Sprint race.
 */
const calendar2026 = [
  {
    round: 1, name: 'Australian Grand Prix', hasSprint: false,
    circuit: 'Albert Park Circuit', country: 'Australia', city: 'Melbourne',
    track: { length_km: 5.278, laps: 58, corners: 14, first_gp: 1996, lap_record: '1:19.813' },
    sessions: { fp1: '2026-03-05T20:30:00Z', fp2: '2026-03-06T00:00:00Z', fp3: '2026-03-06T20:30:00Z', qualifying: '2026-03-07T00:00:00Z', race: '2026-03-07T23:00:00Z' },
  },
  {
    round: 2, name: 'Chinese Grand Prix', hasSprint: true,
    circuit: 'Shanghai International Circuit', country: 'China', city: 'Shanghai',
    track: { length_km: 5.451, laps: 56, corners: 16, first_gp: 2004, lap_record: '1:32.238' },
    sessions: { fp1: '2026-03-13T03:30:00Z', sprint_qualifying: '2026-03-13T07:30:00Z', sprint: '2026-03-14T03:30:00Z', qualifying: '2026-03-14T07:00:00Z', race: '2026-03-15T07:00:00Z' },
  },
  {
    round: 3, name: 'Japanese Grand Prix', hasSprint: false,
    circuit: 'Suzuka International Racing Course', country: 'Japan', city: 'Suzuka',
    track: { length_km: 5.807, laps: 53, corners: 18, first_gp: 1987, lap_record: '1:30.983' },
    sessions: { fp1: '2026-03-27T02:30:00Z', fp2: '2026-03-27T06:00:00Z', fp3: '2026-03-28T02:30:00Z', qualifying: '2026-03-28T06:00:00Z', race: '2026-03-29T05:00:00Z' },
  },
  {
    round: 4, name: 'Bahrain Grand Prix', hasSprint: false,
    circuit: 'Bahrain International Circuit', country: 'Bahrain', city: 'Sakhir',
    track: { length_km: 5.412, laps: 57, corners: 15, first_gp: 2004, lap_record: '1:31.447' },
    sessions: { fp1: '2026-04-10T11:30:00Z', fp2: '2026-04-10T15:00:00Z', fp3: '2026-04-11T12:00:00Z', qualifying: '2026-04-11T15:00:00Z', race: '2026-04-12T15:00:00Z' },
  },
  {
    round: 5, name: 'Saudi Arabian Grand Prix', hasSprint: false,
    circuit: 'Jeddah Corniche Circuit', country: 'Saudi Arabia', city: 'Jeddah',
    track: { length_km: 6.174, laps: 50, corners: 27, first_gp: 2021, lap_record: '1:30.734' },
    sessions: { fp1: '2026-04-17T13:30:00Z', fp2: '2026-04-17T17:00:00Z', fp3: '2026-04-18T13:30:00Z', qualifying: '2026-04-18T17:00:00Z', race: '2026-04-19T17:00:00Z' },
  },
  {
    round: 6, name: 'Miami Grand Prix', hasSprint: true,
    circuit: 'Miami International Autodrome', country: 'USA', city: 'Miami',
    track: { length_km: 5.412, laps: 57, corners: 19, first_gp: 2022, lap_record: '1:29.708' },
    sessions: { fp1: '2026-05-01T16:30:00Z', sprint_qualifying: '2026-05-01T20:30:00Z', sprint: '2026-05-02T16:00:00Z', qualifying: '2026-05-02T20:00:00Z', race: '2026-05-03T19:00:00Z' },
  },
  {
    round: 7, name: 'Canadian Grand Prix', hasSprint: true,
    circuit: 'Circuit Gilles-Villeneuve', country: 'Canada', city: 'Montreal',
    track: { length_km: 4.361, laps: 70, corners: 14, first_gp: 1978, lap_record: '1:13.078' },
    sessions: { fp1: '2026-05-22T17:30:00Z', sprint_qualifying: '2026-05-22T21:30:00Z', sprint: '2026-05-23T16:00:00Z', qualifying: '2026-05-23T20:00:00Z', race: '2026-05-24T18:00:00Z' },
  },
  {
    round: 8, name: 'Spanish Grand Prix', hasSprint: false,
    circuit: 'Circuit de Barcelona-Catalunya', country: 'Spain', city: 'Barcelona',
    track: { length_km: 4.657, laps: 66, corners: 14, first_gp: 1991, lap_record: '1:16.330' },
    sessions: { fp1: '2026-05-29T11:30:00Z', fp2: '2026-05-29T15:00:00Z', fp3: '2026-05-30T10:30:00Z', qualifying: '2026-05-30T14:00:00Z', race: '2026-05-31T13:00:00Z' },
  },
  {
    round: 9, name: 'Monaco Grand Prix', hasSprint: false,
    circuit: 'Circuit de Monaco', country: 'Monaco', city: 'Monte Carlo',
    track: { length_km: 3.337, laps: 78, corners: 19, first_gp: 1950, lap_record: '1:12.909' },
    sessions: { fp1: '2026-06-05T11:30:00Z', fp2: '2026-06-05T15:00:00Z', fp3: '2026-06-06T10:30:00Z', qualifying: '2026-06-06T14:00:00Z', race: '2026-06-07T13:00:00Z' },
  },
  {
    round: 10, name: 'Austrian Grand Prix', hasSprint: false,
    circuit: 'Red Bull Ring', country: 'Austria', city: 'Spielberg',
    track: { length_km: 4.318, laps: 71, corners: 10, first_gp: 1970, lap_record: '1:05.619' },
    sessions: { fp1: '2026-06-19T11:30:00Z', fp2: '2026-06-19T15:00:00Z', fp3: '2026-06-20T10:30:00Z', qualifying: '2026-06-20T14:00:00Z', race: '2026-06-21T13:00:00Z' },
  },
  {
    round: 11, name: 'British Grand Prix', hasSprint: false,
    circuit: 'Silverstone Circuit', country: 'United Kingdom', city: 'Silverstone',
    track: { length_km: 5.891, laps: 52, corners: 18, first_gp: 1950, lap_record: '1:27.097' },
    sessions: { fp1: '2026-07-03T11:30:00Z', fp2: '2026-07-03T15:00:00Z', fp3: '2026-07-04T10:30:00Z', qualifying: '2026-07-04T14:00:00Z', race: '2026-07-05T14:00:00Z' },
  },
  {
    round: 12, name: 'Belgian Grand Prix', hasSprint: true,
    circuit: 'Circuit de Spa-Francorchamps', country: 'Belgium', city: 'Spa',
    track: { length_km: 7.004, laps: 44, corners: 19, first_gp: 1950, lap_record: '1:46.286' },
    sessions: { fp1: '2026-07-24T11:30:00Z', sprint_qualifying: '2026-07-24T15:30:00Z', sprint: '2026-07-25T11:00:00Z', qualifying: '2026-07-25T15:00:00Z', race: '2026-07-26T13:00:00Z' },
  },
  {
    round: 13, name: 'Hungarian Grand Prix', hasSprint: false,
    circuit: 'Hungaroring', country: 'Hungary', city: 'Budapest',
    track: { length_km: 4.381, laps: 70, corners: 14, first_gp: 1986, lap_record: '1:16.627' },
    sessions: { fp1: '2026-07-31T11:30:00Z', fp2: '2026-07-31T15:00:00Z', fp3: '2026-08-01T10:30:00Z', qualifying: '2026-08-01T14:00:00Z', race: '2026-08-02T13:00:00Z' },
  },
  {
    round: 14, name: 'Dutch Grand Prix', hasSprint: false,
    circuit: 'Circuit Zandvoort', country: 'Netherlands', city: 'Zandvoort',
    track: { length_km: 4.259, laps: 72, corners: 14, first_gp: 1952, lap_record: '1:11.097' },
    sessions: { fp1: '2026-08-28T10:30:00Z', fp2: '2026-08-28T14:00:00Z', fp3: '2026-08-29T09:30:00Z', qualifying: '2026-08-29T13:00:00Z', race: '2026-08-30T13:00:00Z' },
  },
  {
    round: 15, name: 'Italian Grand Prix', hasSprint: false,
    circuit: 'Autodromo Nazionale Monza', country: 'Italy', city: 'Monza',
    track: { length_km: 5.793, laps: 53, corners: 11, first_gp: 1950, lap_record: '1:21.046' },
    sessions: { fp1: '2026-09-04T11:30:00Z', fp2: '2026-09-04T15:00:00Z', fp3: '2026-09-05T10:30:00Z', qualifying: '2026-09-05T14:00:00Z', race: '2026-09-06T13:00:00Z' },
  },
  {
    round: 16, name: 'Azerbaijan Grand Prix', hasSprint: false,
    circuit: 'Baku City Circuit', country: 'Azerbaijan', city: 'Baku',
    track: { length_km: 6.003, laps: 51, corners: 20, first_gp: 2017, lap_record: '1:43.009' },
    sessions: { fp1: '2026-09-18T09:30:00Z', fp2: '2026-09-18T13:00:00Z', fp3: '2026-09-19T09:30:00Z', qualifying: '2026-09-19T13:00:00Z', race: '2026-09-20T11:00:00Z' },
  },
  {
    round: 17, name: 'Singapore Grand Prix', hasSprint: false,
    circuit: 'Marina Bay Street Circuit', country: 'Singapore', city: 'Singapore',
    track: { length_km: 4.940, laps: 62, corners: 19, first_gp: 2008, lap_record: '1:35.867' },
    sessions: { fp1: '2026-10-02T09:30:00Z', fp2: '2026-10-02T13:00:00Z', fp3: '2026-10-03T09:30:00Z', qualifying: '2026-10-03T13:00:00Z', race: '2026-10-04T12:00:00Z' },
  },
  {
    round: 18, name: 'United States Grand Prix', hasSprint: true,
    circuit: 'Circuit of the Americas', country: 'USA', city: 'Austin',
    track: { length_km: 5.513, laps: 56, corners: 20, first_gp: 2012, lap_record: '1:36.169' },
    sessions: { fp1: '2026-10-16T17:30:00Z', sprint_qualifying: '2026-10-16T21:30:00Z', sprint: '2026-10-17T17:00:00Z', qualifying: '2026-10-17T21:00:00Z', race: '2026-10-18T19:00:00Z' },
  },
  {
    round: 19, name: 'Mexico City Grand Prix', hasSprint: false,
    circuit: 'Autodromo Hermanos Rodriguez', country: 'Mexico', city: 'Mexico City',
    track: { length_km: 4.304, laps: 71, corners: 17, first_gp: 1963, lap_record: '1:17.774' },
    sessions: { fp1: '2026-10-23T18:30:00Z', fp2: '2026-10-23T22:00:00Z', fp3: '2026-10-24T17:30:00Z', qualifying: '2026-10-24T21:00:00Z', race: '2026-10-25T20:00:00Z' },
  },
  {
    round: 20, name: 'São Paulo Grand Prix', hasSprint: true,
    circuit: 'Autodromo Jose Carlos Pace', country: 'Brazil', city: 'São Paulo',
    track: { length_km: 4.309, laps: 71, corners: 15, first_gp: 1973, lap_record: '1:10.540' },
    sessions: { fp1: '2026-10-30T14:30:00Z', sprint_qualifying: '2026-10-30T18:30:00Z', sprint: '2026-10-31T14:00:00Z', qualifying: '2026-10-31T18:00:00Z', race: '2026-11-01T17:00:00Z' },
  },
  {
    round: 21, name: 'Las Vegas Grand Prix', hasSprint: false,
    circuit: 'Las Vegas Street Circuit', country: 'USA', city: 'Las Vegas',
    track: { length_km: 6.201, laps: 50, corners: 17, first_gp: 2023, lap_record: '1:35.119' },
    sessions: { fp1: '2026-11-19T04:30:00Z', fp2: '2026-11-19T08:00:00Z', fp3: '2026-11-20T04:30:00Z', qualifying: '2026-11-20T08:00:00Z', race: '2026-11-21T06:00:00Z' },
  },
  {
    round: 22, name: 'Qatar Grand Prix', hasSprint: true,
    circuit: 'Lusail International Circuit', country: 'Qatar', city: 'Lusail',
    track: { length_km: 5.380, laps: 57, corners: 16, first_gp: 2021, lap_record: '1:24.319' },
    sessions: { fp1: '2026-11-27T13:30:00Z', sprint_qualifying: '2026-11-27T17:30:00Z', sprint: '2026-11-28T13:30:00Z', qualifying: '2026-11-28T17:00:00Z', race: '2026-11-29T15:00:00Z' },
  },
  {
    round: 23, name: 'Abu Dhabi Grand Prix', hasSprint: false,
    circuit: 'Yas Marina Circuit', country: 'UAE', city: 'Abu Dhabi',
    track: { length_km: 5.281, laps: 58, corners: 16, first_gp: 2009, lap_record: '1:26.103' },
    sessions: { fp1: '2026-12-04T09:30:00Z', fp2: '2026-12-04T13:00:00Z', fp3: '2026-12-05T10:30:00Z', qualifying: '2026-12-05T14:00:00Z', race: '2026-12-06T13:00:00Z' },
  },
];

// F1 2026 points systems
const RACE_POINTS   = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];
const FASTEST_LAP_POINT = 1; // awarded if driver finishes P1-P10

module.exports = { calendar2026, RACE_POINTS, SPRINT_POINTS, FASTEST_LAP_POINT };
