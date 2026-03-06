const { EventEmitter } = require('events');
const { deepMerge } = require('./merge');

/**
 * In-memory state store for all F1 timing topics.
 * Acts as an EventEmitter so SSE clients can subscribe to live updates.
 */
class F1State extends EventEmitter {
  constructor() {
    super();
    this.setMaxListeners(200);
    this.reset();
  }

  reset() {
    this.connected    = false;
    this.sessionInfo  = {};
    this.sessionData  = {};
    this.driverList   = {};
    this.timingData   = {};
    this.timingAppData = {};
    this.timingStats  = {};
    this.carData      = {};
    this.position     = {};
    this.weatherData  = {};
    this.trackStatus  = {};
    this.raceControl  = { Messages: [] };
    this.lapCount     = {};
    this.extrapolatedClock = {};
    this.topThree     = {};
    this.heartbeat    = {};
    this._lastUpdate  = null;
  }

  /** Apply a differential patch from the F1 feed to the relevant topic state. */
  applyUpdate(topic, data) {
    const ts = new Date().toISOString();
    this._lastUpdate = ts;

    switch (topic) {
      case 'SessionInfo':       this.sessionInfo       = deepMerge(this.sessionInfo, data); break;
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
      case 'RaceControlMessages':
        if (data?.Messages) {
          // Merge new messages (keyed by index) into the messages list
          const existing = this.raceControl.Messages || [];
          const patch = data.Messages;
          if (Array.isArray(patch)) {
            this.raceControl.Messages = [...existing, ...patch];
          } else {
            // Object with numeric keys
            Object.values(patch).forEach(msg => existing.push(msg));
            this.raceControl.Messages = existing;
          }
        }
        break;
      default:
        break;
    }

    this.emit('update', { topic, data, timestamp: ts });
    this.emit(`topic:${topic}`, { data, timestamp: ts });
  }

  /** Returns a clean snapshot of everything. */
  snapshot() {
    return {
      connected:        this.connected,
      last_update:      this._lastUpdate,
      session:          this.sessionInfo,
      session_data:     this.sessionData,
      drivers:          this.driverList,
      timing:           this.timingData,
      timing_app:       this.timingAppData,
      timing_stats:     this.timingStats,
      car_data:         this.carData,
      position:         this.position,
      weather:          this.weatherData,
      track_status:     this.trackStatus,
      race_control:     this.raceControl,
      lap_count:        this.lapCount,
      clock:            this.extrapolatedClock,
      top_three:        this.topThree,
    };
  }
}

// Singleton
module.exports = new F1State();
