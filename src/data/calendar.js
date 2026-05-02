/**
 * Full 2026 F1 World Championship Calendar
 * Sessions times are in UTC.
 * hasSprint: true means the weekend includes a Sprint race.
 * Source: f1calendar.com (IST) converted to UTC (IST - 5:30)
 */
const calendar2026 = [
  {
    round: 1, name: 'Australian Grand Prix', hasSprint: false,
    circuit: 'Albert Park Circuit', country: 'Australia', city: 'Melbourne',
    lat: -37.8497, lon: 144.9680,
    track: { length_km: 5.278, laps: 58, corners: 14, first_gp: 1996, lap_record: '1:19.813' },
    sessions: { fp1: '2026-03-05T20:30:00Z', fp2: '2026-03-06T00:00:00Z', fp3: '2026-03-06T20:30:00Z', qualifying: '2026-03-07T00:00:00Z', race: '2026-03-07T23:00:00Z' },
  },
  {
    round: 2, name: 'Chinese Grand Prix', hasSprint: true,
    circuit: 'Shanghai International Circuit', country: 'China', city: 'Shanghai',
    lat: 31.3389, lon: 121.2197,
    track: { length_km: 5.451, laps: 56, corners: 16, first_gp: 2004, lap_record: '1:32.238' },
    sessions: { fp1: '2026-03-13T03:30:00Z', sprint_qualifying: '2026-03-13T07:30:00Z', sprint: '2026-03-14T03:30:00Z', qualifying: '2026-03-14T07:00:00Z', race: '2026-03-15T07:00:00Z' },
  },
  {
    round: 3, name: 'Japanese Grand Prix', hasSprint: false,
    circuit: 'Suzuka International Racing Course', country: 'Japan', city: 'Suzuka',
    lat: 34.8431, lon: 136.5407,
    track: { length_km: 5.807, laps: 53, corners: 18, first_gp: 1987, lap_record: '1:30.983' },
    sessions: { fp1: '2026-03-27T02:30:00Z', fp2: '2026-03-27T06:00:00Z', fp3: '2026-03-28T02:30:00Z', qualifying: '2026-03-28T06:00:00Z', race: '2026-03-29T05:00:00Z' },
  },
  {
    round: 4, name: 'Bahrain Grand Prix', hasSprint: false,
    circuit: 'Bahrain International Circuit', country: 'Bahrain', city: 'Sakhir',
    lat: 26.0325, lon: 50.5106,
    track: { length_km: 5.412, laps: 57, corners: 15, first_gp: 2004, lap_record: '1:31.447' },
    sessions: { fp1: '2026-04-10T11:30:00Z', fp2: '2026-04-10T15:00:00Z', fp3: '2026-04-11T12:00:00Z', qualifying: '2026-04-11T15:00:00Z', race: '2026-04-12T15:00:00Z' },
  },
  {
    round: 5, name: 'Saudi Arabian Grand Prix', hasSprint: false,
    circuit: 'Jeddah Corniche Circuit', country: 'Saudi Arabia', city: 'Jeddah',
    lat: 21.6319, lon: 39.1044,
    track: { length_km: 6.174, laps: 50, corners: 27, first_gp: 2021, lap_record: '1:30.734' },
    sessions: { fp1: '2026-04-17T13:30:00Z', fp2: '2026-04-17T17:00:00Z', fp3: '2026-04-18T13:30:00Z', qualifying: '2026-04-18T17:00:00Z', race: '2026-04-19T17:00:00Z' },
  },
  {
    round: 6, name: 'Miami Grand Prix', hasSprint: true,
    circuit: 'Miami International Autodrome', country: 'USA', city: 'Miami',
    lat: 25.9581, lon: -80.2389,
    track: { length_km: 5.412, laps: 57, corners: 19, first_gp: 2022, lap_record: '1:29.708' },
    // fp1: 1 May 21:30 IST, sq: 2 May 02:00 IST, sprint: 2 May 21:30 IST, q: 3 May 01:30 IST, race: 4 May 01:30 IST
    sessions: { fp1: '2026-05-01T16:00:00Z', sprint_qualifying: '2026-05-01T20:30:00Z', sprint: '2026-05-02T16:00:00Z', qualifying: '2026-05-02T20:00:00Z', race: '2026-05-03T20:00:00Z' },
  },
  {
    round: 7, name: 'Canadian Grand Prix', hasSprint: true,
    circuit: 'Circuit Gilles-Villeneuve', country: 'Canada', city: 'Montreal',
    lat: 45.5017, lon: -73.5228,
    track: { length_km: 4.361, laps: 70, corners: 14, first_gp: 1978, lap_record: '1:13.078' },
    // fp1: 22 May 22:00 IST, sq: 23 May 02:00 IST, sprint: 23 May 21:30 IST, q: 24 May 01:30 IST, race: 25 May 01:30 IST
    sessions: { fp1: '2026-05-22T16:30:00Z', sprint_qualifying: '2026-05-22T20:30:00Z', sprint: '2026-05-23T16:00:00Z', qualifying: '2026-05-23T20:00:00Z', race: '2026-05-24T20:00:00Z' },
  },
  {
    round: 8, name: 'Monaco Grand Prix', hasSprint: false,
    circuit: 'Circuit de Monaco', country: 'Monaco', city: 'Monte Carlo',
    lat: 43.7347, lon: 7.4206,
    track: { length_km: 3.337, laps: 78, corners: 19, first_gp: 1950, lap_record: '1:12.909' },
    // fp1: 5 Jun 17:00 IST, fp2: 5 Jun 20:30 IST, fp3: 6 Jun 16:00 IST, q: 6 Jun 19:30 IST, race: 7 Jun 18:30 IST
    sessions: { fp1: '2026-06-05T11:30:00Z', fp2: '2026-06-05T15:00:00Z', fp3: '2026-06-06T10:30:00Z', qualifying: '2026-06-06T14:00:00Z', race: '2026-06-07T13:00:00Z' },
  },
  {
    round: 9, name: 'Barcelona-Catalunya Grand Prix', hasSprint: false,
    circuit: 'Circuit de Barcelona-Catalunya', country: 'Spain', city: 'Barcelona',
    lat: 41.5700, lon: 2.2611,
    track: { length_km: 4.657, laps: 66, corners: 14, first_gp: 1991, lap_record: '1:16.330' },
    // fp1: 12 Jun 17:00 IST, fp2: 12 Jun 20:30 IST, fp3: 13 Jun 16:00 IST, q: 13 Jun 19:30 IST, race: 14 Jun 18:30 IST
    sessions: { fp1: '2026-06-12T11:30:00Z', fp2: '2026-06-12T15:00:00Z', fp3: '2026-06-13T10:30:00Z', qualifying: '2026-06-13T14:00:00Z', race: '2026-06-14T13:00:00Z' },
  },
  {
    round: 10, name: 'Austrian Grand Prix', hasSprint: false,
    circuit: 'Red Bull Ring', country: 'Austria', city: 'Spielberg',
    lat: 47.2197, lon: 14.7647,
    track: { length_km: 4.318, laps: 71, corners: 10, first_gp: 1970, lap_record: '1:05.619' },
    // fp1: 26 Jun 17:00 IST, fp2: 26 Jun 20:30 IST, fp3: 27 Jun 16:00 IST, q: 27 Jun 19:30 IST, race: 28 Jun 18:30 IST
    sessions: { fp1: '2026-06-26T11:30:00Z', fp2: '2026-06-26T15:00:00Z', fp3: '2026-06-27T10:30:00Z', qualifying: '2026-06-27T14:00:00Z', race: '2026-06-28T13:00:00Z' },
  },
  {
    round: 11, name: 'British Grand Prix', hasSprint: true,
    circuit: 'Silverstone Circuit', country: 'United Kingdom', city: 'Silverstone',
    lat: 52.0786, lon: -1.0169,
    track: { length_km: 5.891, laps: 52, corners: 18, first_gp: 1950, lap_record: '1:27.097' },
    // fp1: 3 Jul 17:00 IST, sq: 3 Jul 21:00 IST, sprint: 4 Jul 16:30 IST, q: 4 Jul 20:30 IST, race: 5 Jul 19:30 IST
    sessions: { fp1: '2026-07-03T11:30:00Z', sprint_qualifying: '2026-07-03T15:30:00Z', sprint: '2026-07-04T11:00:00Z', qualifying: '2026-07-04T15:00:00Z', race: '2026-07-05T14:00:00Z' },
  },
  {
    round: 12, name: 'Belgian Grand Prix', hasSprint: false,
    circuit: 'Circuit de Spa-Francorchamps', country: 'Belgium', city: 'Spa',
    lat: 50.4372, lon: 5.9714,
    track: { length_km: 7.004, laps: 44, corners: 19, first_gp: 1950, lap_record: '1:46.286' },
    // fp1: 17 Jul 17:00 IST, fp2: 17 Jul 20:30 IST, fp3: 18 Jul 16:00 IST, q: 18 Jul 19:30 IST, race: 19 Jul 18:30 IST
    sessions: { fp1: '2026-07-17T11:30:00Z', fp2: '2026-07-17T15:00:00Z', fp3: '2026-07-18T10:30:00Z', qualifying: '2026-07-18T14:00:00Z', race: '2026-07-19T13:00:00Z' },
  },
  {
    round: 13, name: 'Hungarian Grand Prix', hasSprint: false,
    circuit: 'Hungaroring', country: 'Hungary', city: 'Budapest',
    lat: 47.5789, lon: 19.2486,
    track: { length_km: 4.381, laps: 70, corners: 14, first_gp: 1986, lap_record: '1:16.627' },
    // fp1: 24 Jul 17:00 IST, fp2: 24 Jul 20:30 IST, fp3: 25 Jul 16:00 IST, q: 25 Jul 19:30 IST, race: 26 Jul 18:30 IST
    sessions: { fp1: '2026-07-24T11:30:00Z', fp2: '2026-07-24T15:00:00Z', fp3: '2026-07-25T10:30:00Z', qualifying: '2026-07-25T14:00:00Z', race: '2026-07-26T13:00:00Z' },
  },
  {
    round: 14, name: 'Dutch Grand Prix', hasSprint: true,
    circuit: 'Circuit Zandvoort', country: 'Netherlands', city: 'Zandvoort',
    lat: 52.3888, lon: 4.5409,
    track: { length_km: 4.259, laps: 72, corners: 14, first_gp: 1952, lap_record: '1:11.097' },
    // fp1: 21 Aug 16:00 IST, sq: 21 Aug 20:00 IST, sprint: 22 Aug 15:30 IST, q: 22 Aug 19:30 IST, race: 23 Aug 18:30 IST
    sessions: { fp1: '2026-08-21T10:30:00Z', sprint_qualifying: '2026-08-21T14:30:00Z', sprint: '2026-08-22T10:00:00Z', qualifying: '2026-08-22T14:00:00Z', race: '2026-08-23T13:00:00Z' },
  },
  {
    round: 15, name: 'Italian Grand Prix', hasSprint: false,
    circuit: 'Autodromo Nazionale Monza', country: 'Italy', city: 'Monza',
    lat: 45.6156, lon: 9.2811,
    track: { length_km: 5.793, laps: 53, corners: 11, first_gp: 1950, lap_record: '1:21.046' },
    // fp1: 4 Sep 16:00 IST, fp2: 4 Sep 19:30 IST, fp3: 5 Sep 16:00 IST, q: 5 Sep 19:30 IST, race: 6 Sep 18:30 IST
    sessions: { fp1: '2026-09-04T10:30:00Z', fp2: '2026-09-04T14:00:00Z', fp3: '2026-09-05T10:30:00Z', qualifying: '2026-09-05T14:00:00Z', race: '2026-09-06T13:00:00Z' },
  },
  {
    round: 16, name: 'Spanish Grand Prix', hasSprint: false,
    circuit: 'Madrid Street Circuit', country: 'Spain', city: 'Madrid',
    lat: 40.4712, lon: -3.6056,
    track: { length_km: 5.474, laps: 52, corners: 20, first_gp: 2026, lap_record: 'N/A' },
    // fp1: 11 Sep 17:00 IST, fp2: 11 Sep 20:30 IST, fp3: 12 Sep 16:00 IST, q: 12 Sep 19:30 IST, race: 13 Sep 18:30 IST
    sessions: { fp1: '2026-09-11T11:30:00Z', fp2: '2026-09-11T15:00:00Z', fp3: '2026-09-12T10:30:00Z', qualifying: '2026-09-12T14:00:00Z', race: '2026-09-13T13:00:00Z' },
  },
  {
    round: 17, name: 'Azerbaijan Grand Prix', hasSprint: false,
    circuit: 'Baku City Circuit', country: 'Azerbaijan', city: 'Baku',
    lat: 40.3725, lon: 49.8533,
    track: { length_km: 6.003, laps: 51, corners: 20, first_gp: 2017, lap_record: '1:43.009' },
    // fp1: 24 Sep 14:00 IST, fp2: 24 Sep 17:30 IST, fp3: 25 Sep 14:00 IST, q: 25 Sep 17:30 IST, race: 26 Sep 16:30 IST
    sessions: { fp1: '2026-09-24T08:30:00Z', fp2: '2026-09-24T12:00:00Z', fp3: '2026-09-25T08:30:00Z', qualifying: '2026-09-25T12:00:00Z', race: '2026-09-26T11:00:00Z' },
  },
  {
    round: 18, name: 'Singapore Grand Prix', hasSprint: true,
    circuit: 'Marina Bay Street Circuit', country: 'Singapore', city: 'Singapore',
    lat: 1.2914, lon: 103.8640,
    track: { length_km: 4.940, laps: 62, corners: 19, first_gp: 2008, lap_record: '1:35.867' },
    // fp1: 9 Oct 14:00 IST, sq: 9 Oct 18:00 IST, sprint: 10 Oct 14:30 IST, q: 10 Oct 18:30 IST, race: 11 Oct 17:30 IST
    sessions: { fp1: '2026-10-09T08:30:00Z', sprint_qualifying: '2026-10-09T12:30:00Z', sprint: '2026-10-10T09:00:00Z', qualifying: '2026-10-10T13:00:00Z', race: '2026-10-11T12:00:00Z' },
  },
  {
    round: 19, name: 'United States Grand Prix', hasSprint: false,
    circuit: 'Circuit of the Americas', country: 'USA', city: 'Austin',
    lat: 30.1328, lon: -97.6411,
    track: { length_km: 5.513, laps: 56, corners: 20, first_gp: 2012, lap_record: '1:36.169' },
    // fp1: 23 Oct 23:00 IST, fp2: 24 Oct 02:30 IST, fp3: 24 Oct 23:00 IST, q: 25 Oct 02:30 IST, race: 26 Oct 01:30 IST
    sessions: { fp1: '2026-10-23T17:30:00Z', fp2: '2026-10-23T21:00:00Z', fp3: '2026-10-24T17:30:00Z', qualifying: '2026-10-24T21:00:00Z', race: '2026-10-25T20:00:00Z' },
  },
  {
    round: 20, name: 'Mexico City Grand Prix', hasSprint: false,
    circuit: 'Autodromo Hermanos Rodriguez', country: 'Mexico', city: 'Mexico City',
    lat: 19.4042, lon: -99.0907,
    track: { length_km: 4.304, laps: 71, corners: 17, first_gp: 1963, lap_record: '1:17.774' },
    // fp1: 31 Oct 00:00 IST, fp2: 31 Oct 03:30 IST, fp3: 31 Oct 23:00 IST, q: 1 Nov 02:30 IST, race: 2 Nov 01:30 IST
    sessions: { fp1: '2026-10-30T18:30:00Z', fp2: '2026-10-30T22:00:00Z', fp3: '2026-10-31T17:30:00Z', qualifying: '2026-10-31T21:00:00Z', race: '2026-11-01T20:00:00Z' },
  },
  {
    round: 21, name: 'Brazilian Grand Prix', hasSprint: false,
    circuit: 'Autodromo Jose Carlos Pace', country: 'Brazil', city: 'Sao Paulo',
    lat: -23.7014, lon: -46.6969,
    track: { length_km: 4.309, laps: 71, corners: 15, first_gp: 1973, lap_record: '1:10.540' },
    // fp1: 6 Nov 21:00 IST, fp2: 7 Nov 00:30 IST, fp3: 7 Nov 20:00 IST, q: 7 Nov 23:30 IST, race: 8 Nov 22:30 IST
    sessions: { fp1: '2026-11-06T15:30:00Z', fp2: '2026-11-06T19:00:00Z', fp3: '2026-11-07T14:30:00Z', qualifying: '2026-11-07T18:00:00Z', race: '2026-11-08T17:00:00Z' },
  },
  {
    round: 22, name: 'Las Vegas Grand Prix', hasSprint: false,
    circuit: 'Las Vegas Street Circuit', country: 'USA', city: 'Las Vegas',
    lat: 36.1147, lon: -115.1728,
    track: { length_km: 6.201, laps: 50, corners: 17, first_gp: 2023, lap_record: '1:35.119' },
    // fp1: 20 Nov 06:00 IST, fp2: 20 Nov 09:30 IST, fp3: 21 Nov 06:00 IST, q: 21 Nov 09:30 IST, race: 22 Nov 09:30 IST
    sessions: { fp1: '2026-11-20T00:30:00Z', fp2: '2026-11-20T04:00:00Z', fp3: '2026-11-21T00:30:00Z', qualifying: '2026-11-21T04:00:00Z', race: '2026-11-22T04:00:00Z' },
  },
  {
    round: 23, name: 'Qatar Grand Prix', hasSprint: false,
    circuit: 'Lusail International Circuit', country: 'Qatar', city: 'Lusail',
    lat: 25.4900, lon: 51.4542,
    track: { length_km: 5.380, laps: 57, corners: 16, first_gp: 2021, lap_record: '1:24.319' },
    // fp1: 27 Nov 19:00 IST, fp2: 27 Nov 22:30 IST, fp3: 28 Nov 20:00 IST, q: 28 Nov 23:30 IST, race: 29 Nov 21:30 IST
    sessions: { fp1: '2026-11-27T13:30:00Z', fp2: '2026-11-27T17:00:00Z', fp3: '2026-11-28T14:30:00Z', qualifying: '2026-11-28T18:00:00Z', race: '2026-11-29T16:00:00Z' },
  },
  {
    round: 24, name: 'Abu Dhabi Grand Prix', hasSprint: false,
    circuit: 'Yas Marina Circuit', country: 'UAE', city: 'Abu Dhabi',
    lat: 24.4672, lon: 54.6031,
    track: { length_km: 5.281, laps: 58, corners: 16, first_gp: 2009, lap_record: '1:26.103' },
    // fp1: 4 Dec 15:00 IST, fp2: 4 Dec 18:30 IST, fp3: 5 Dec 16:00 IST, q: 5 Dec 19:30 IST, race: 6 Dec 18:30 IST
    sessions: { fp1: '2026-12-04T09:30:00Z', fp2: '2026-12-04T13:00:00Z', fp3: '2026-12-05T10:30:00Z', qualifying: '2026-12-05T14:00:00Z', race: '2026-12-06T13:00:00Z' },
  },
];

// F1 2026 points systems
const RACE_POINTS   = [25, 18, 15, 12, 10, 8, 6, 4, 2, 1];
const SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1];
const FASTEST_LAP_POINT = 1; // awarded if driver finishes P1-P10

module.exports = { calendar2026, RACE_POINTS, SPRINT_POINTS, FASTEST_LAP_POINT };
