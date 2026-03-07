const { EventEmitter } = require('events');
const { deepMerge }    = require('./merge');
const persistence      = require('./persistence');

class F1State extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(200);
    this._sessionSaved = false; // prevent double-saving same session
    this.reset();
    this._loadPersistedState();
  }

  reset() {
    this.connected         = false;
    this.sessionInfo       = {};
    this.sessionData       = {};
    this.driverList        = {};
    this.timingData        = {};
    this.timingAppData     = {};
    this.timingStats       = {};
    this.carData           = {};
    this.position          = {};
    this.weatherData       = {};
    this.trackStatus       = {};
    this.raceControl       = { Messages: [] };
    this.lapCount          = {};
    this.extrapolatedClock = {};
    this.topThree          = {};
    this.teamRadio         = { Captures: [] };
    this.heartbeat         = {};
    this._lastUpdate       = null;
    this._sessionSaved     = false;
  }

  /** On startup, restore the last known state so data survives restarts. */
  _loadPersistedState() {
    const saved = persistence.loadLastState();
    if (!saved) return;
    this.sessionInfo       = saved.session       || {};
    this.sessionData       = saved.session_data  || {};
    this.driverList        = saved.drivers       || {};
    this.timingData        = saved.timing        || {};
    this.timingAppData     = saved.timing_app    || {};
    this.timingStats       = saved.timing_stats  || {};
    this.weatherData       = saved.weather       || {};
    this.trackStatus       = saved.track_status  || {};
    this.raceControl       = saved.race_control  || { Messages: [] };
    this.lapCount          = saved.lap_count     || {};
    this.extrapolatedClock = saved.clock         || {};
    this.topThree          = saved.top_three     || {};
    this.teamRadio         = saved.team_radio    || { Captures: [] };
    this._lastUpdate       = saved.last_update   || null;
    console.log('[F1] Restored persisted state from disk');
  }

  applyUpdate(topic, data) {
    const ts = new Date().toISOString();
    this._lastUpdate = ts;

    switch (topic) {
      case 'SessionInfo':
        // Detect when session changes — reset saved flag
        if (data.Key && data.Key !== this.sessionInfo.Key) {
          this._sessionSaved = false;
        }
        this.sessionInfo = deepMerge(this.sessionInfo, data);
        // Auto-save when session is finalised
        if (this.sessionInfo.SessionStatus === 'Finalised' && !this._sessionSaved) {
          this._sessionSaved = true;
          setImmediate(() => this._saveSession());
        }
        break;
      case 'SessionData':       this.sessionData       = deepMerge(this.sessionData, data); break;
      case 'DriverList':        this.driverList        = deepMerge(this.driverList, data); break;
      case 'TimingData':        this.timingData        = deepMerge(this.timingData, data); break;
      case 'TimingAppData':     this.timingAppData     = deepMerge(this.timingAppData, data); break;
      case 'TimingStats':       this.timingStats       = deepMerge(this.timingStats, data); break;
      case 'CarData':
      case 'CarData.z':         this.carData           = deepMerge(this.carData, data); break;
      case 'Position':
      case 'Position.z':        this.position          = deepMerge(this.position, data); break;
      case 'WeatherData':       this.weatherData       = deepMerge(this.weatherData, data); break;
      case 'TrackStatus':       this.trackStatus       = deepMerge(this.trackStatus, data); break;
      case 'LapCount':          this.lapCount          = deepMerge(this.lapCount, data); break;
      case 'ExtrapolatedClock': this.extrapolatedClock = deepMerge(this.extrapolatedClock, data); break;
      case 'TopThree':          this.topThree          = deepMerge(this.topThree, data); break;
      case 'Heartbeat':         this.heartbeat         = data; break;
      case 'TeamRadio':
        if (data?.Captures) {
          const existing = this.teamRadio.Captures || [];
          const patch    = data.Captures;
          if (Array.isArray(patch)) {
            this.teamRadio.Captures = [...existing, ...patch];
          } else {
            Object.values(patch).forEach(cap => existing.push(cap));
            this.teamRadio.Captures = existing;
          }
        }
        break;
      case 'RaceControlMessages':
        if (data?.Messages) {
          const existing = this.raceControl.Messages || [];
          const patch    = data.Messages;
          if (Array.isArray(patch)) {
            this.raceControl.Messages = [...existing, ...patch];
          } else {
            Object.values(patch).forEach(msg => existing.push(msg));
            this.raceControl.Messages = existing;
          }
        }
        break;
      default: break;
    }

    // Persist state to disk every 30 seconds (debounced)
    this._schedulePersist();

    this.emit('update', { topic, data, timestamp: ts });
    this.emit(`topic:${topic}`, { data, timestamp: ts });
  }

  _saveSession() {
    const filename = persistence.saveSessionResult(
      this.sessionInfo,
      this.timingData,
      this.timingAppData,
      this.timingStats,
      this.weatherData,
      this.lapCount,
    );
    if (filename) {
      this.emit('session:saved', { filename, session: this.sessionInfo });
    }
  }

  _schedulePersist() {
    if (this._persistTimer) return;
    this._persistTimer = setTimeout(() => {
      this._persistTimer = null;
      persistence.saveLastState(this.snapshot());
    }, 30000); // debounce: write at most every 30s
  }

  snapshot() {
    return {
      connected:    this.connected,
      last_update:  this._lastUpdate,
      session:      this.sessionInfo,
      session_data: this.sessionData,
      drivers:      this.driverList,
      timing:       this.timingData,
      timing_app:   this.timingAppData,
      timing_stats: this.timingStats,
      car_data:     this.carData,
      position:     this.position,
      weather:      this.weatherData,
      track_status: this.trackStatus,
      race_control: this.raceControl,
      team_radio:   this.teamRadio,
      lap_count:    this.lapCount,
      clock:        this.extrapolatedClock,
      top_three:    this.topThree,
    };
  }
}

module.exports = new F1State();
