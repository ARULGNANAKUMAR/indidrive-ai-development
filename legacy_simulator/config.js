// ============================================================
// IndiDrive AI Lab — Configuration
// Non-secret application settings only. No API keys here.
// ============================================================

const CONFIG = Object.freeze({
  // API — works both standalone (legacy_simulator/server.py run directly
  // on its own port) and mounted inside the unified Phase 5 platform at
  // /simulator: detect which one served this page and prefix accordingly.
  API_BASE_URL: window.location.pathname.startsWith('/simulator') ? '/simulator' : '',
  API_TIMEOUT: 10000,

  // Canvas
  CANVAS_WIDTH: 900,
  CANVAS_HEIGHT: 580,

  // Simulation
  SIMULATION_SPEED: 1.0,
  MAX_OBJECTS: 50,
  MAX_SCENARIO_SIZE: 200,
  FPS_TARGET: 60,
  PIXELS_PER_METER: 8,

  // AI update intervals (ms)
  SENSOR_UPDATE_RATE: 120,
  AI_UPDATE_RATE: 200,
  RISK_UPDATE_RATE: 150,
  REPLAN_UPDATE_RATE: 350,

  // AI thresholds
  DEFAULT_TTC_THRESHOLD: 3.0,
  DEFAULT_RISK_THRESHOLD: 0.65,
  EMERGENCY_RISK_THRESHOLD: 0.85,
  DETECTION_RANGE: 50,    // metres
  SENSOR_NOISE: 0.05,

  // Ego vehicle
  MAX_SPEED: 100,          // km/h
  DEFAULT_SPEED: 40,
  MAX_ACCELERATION: 5,     // m/s²
  MAX_DECELERATION: 8,
  EMERGENCY_DECEL: 14,
  STEERING_RATE: 3.5,      // degrees/frame

  // Dataset / uploads
  MAX_UPLOAD_SIZE: 50 * 1024 * 1024, // 50 MB
  ALLOWED_DATASET_TYPES: ['json', 'csv'],

  // Models
  DEFAULT_MODEL: 'IndiDrive-V1',
  MODEL_VERSIONS: ['IndiDrive-V1', 'IndiDrive-V2', 'IndiDrive-V3'],

  // Security
  ALLOWED_ORIGINS: [
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    'http://localhost:3000',
  ],

  DEBUG_MODE: false,
  SHOW_SENSOR_RAYS: true,
  SHOW_PREDICTIONS: true,
  SHOW_RISK_ZONES: true,
  SHOW_PATH: true,
});

// ── Road types ────────────────────────────────────────────────
const ROAD_TYPES = {
  VILLAGE:  { label: 'Village Road',       lanes: 2, width: 6,  speedLimit: 30 },
  URBAN:    { label: 'Urban Road',         lanes: 2, width: 8,  speedLimit: 40 },
  HIGHWAY:  { label: 'Highway',            lanes: 4, width: 16, speedLimit: 100 },
  MARKET:   { label: 'Market Road',        lanes: 1, width: 5,  speedLimit: 20 },
  NARROW:   { label: 'Narrow Road',        lanes: 1, width: 4,  speedLimit: 20 },
  UNMARKED: { label: 'Unmarked Road',      lanes: 2, width: 7,  speedLimit: 35 },
  MOUNTAIN: { label: 'Mountain/Rocky Road',lanes: 1, width: 5,  speedLimit: 25 },
  DAMAGED:  { label: 'Damaged Road',       lanes: 2, width: 7,  speedLimit: 30 },
};

// ── Hazard types ──────────────────────────────────────────────
const HAZARD_TYPES = {
  POTHOLE:        { label: 'Pothole',           color: '#1a0a00', riskMod: 0.4, size: [1.0, 1.5] },
  CRACK:          { label: 'Crack',             color: '#2a1a0a', riskMod: 0.2, size: [2.0, 0.3] },
  BROKEN_ASPHALT: { label: 'Broken Asphalt',   color: '#3a2010', riskMod: 0.3, size: [2.0, 1.5] },
  GRAVEL:         { label: 'Loose Gravel',      color: '#8a7060', riskMod: 0.25, size: [2.0, 2.0] },
  ROCKS:          { label: 'Loose Rocks',       color: '#5a5050', riskMod: 0.5, size: [0.5, 0.5] },
  FALLEN_ROCKS:   { label: 'Fallen Rocks',      color: '#4a4040', riskMod: 0.8, size: [1.2, 1.0] },
  MUD:            { label: 'Mud',               color: '#6b4a2a', riskMod: 0.35, size: [2.5, 2.0] },
  SAND:           { label: 'Sand',              color: '#c8a870', riskMod: 0.3, size: [3.0, 2.0] },
  WATERLOGGING:   { label: 'Waterlogging',      color: '#1a4a7a', riskMod: 0.4, size: [3.0, 2.0] },
  BROKEN_EDGE:    { label: 'Broken Road Edge',  color: '#2a1500', riskMod: 0.5, size: [1.0, 3.0] },
  CONSTRUCTION:   { label: 'Construction Zone', color: '#ff8800', riskMod: 0.6, size: [4.0, 3.0] },
  DEBRIS:         { label: 'Road Debris',       color: '#5a4a3a', riskMod: 0.55, size: [1.0, 0.8] },
  MANHOLE:        { label: 'Open Manhole',      color: '#0a0a0a', riskMod: 0.7, size: [0.8, 0.8] },
  SPEED_BREAKER:  { label: 'Speed Breaker',     color: '#ffe000', riskMod: 0.2, size: [4.0, 0.5] },
};

// ── Traffic object types ──────────────────────────────────────
const OBJECT_TYPES = {
  CAR:        { label: 'Car',          w: 2.0, h: 4.0, color: '#4488ff', maxSpeed: 80,  risk: 0.60 },
  BIKE:       { label: 'Bike',         w: 0.9, h: 2.2, color: '#ff8844', maxSpeed: 70,  risk: 0.70 },
  SCOOTER:    { label: 'Scooter',      w: 0.8, h: 1.8, color: '#ff6633', maxSpeed: 60,  risk: 0.65 },
  AUTO:       { label: 'Auto',         w: 1.6, h: 2.8, color: '#ffcc00', maxSpeed: 50,  risk: 0.65 },
  BUS:        { label: 'Bus',          w: 2.5, h: 8.0, color: '#22aa55', maxSpeed: 60,  risk: 0.70 },
  TRUCK:      { label: 'Truck',        w: 2.5, h: 7.0, color: '#cc5522', maxSpeed: 70,  risk: 0.75 },
  TRACTOR:    { label: 'Tractor',      w: 2.0, h: 3.5, color: '#886622', maxSpeed: 30,  risk: 0.60 },
  CYCLE:      { label: 'Cycle',        w: 0.7, h: 1.8, color: '#88cc44', maxSpeed: 25,  risk: 0.50 },
  PEDESTRIAN: { label: 'Pedestrian',   w: 0.5, h: 1.7, color: '#ff44aa', maxSpeed: 6,   risk: 1.00 },
  CATTLE:     { label: 'Cattle',       w: 1.2, h: 2.0, color: '#aa8855', maxSpeed: 10,  risk: 0.95 },
  PUSHCART:   { label: 'Pushcart',     w: 1.0, h: 1.5, color: '#bb9944', maxSpeed: 5,   risk: 0.55 },
  OBSTACLE:   { label: 'Obstacle',     w: 1.0, h: 1.0, color: '#cc3333', maxSpeed: 0,   risk: 0.80 },
  ROCK:       { label: 'Rock',         w: 0.8, h: 0.8, color: '#888888', maxSpeed: 0,   risk: 0.80 },
  DEBRIS:     { label: 'Debris',       w: 1.5, h: 0.6, color: '#997755', maxSpeed: 0,   risk: 0.65 },
};

// ── Traffic behaviours ────────────────────────────────────────
const BEHAVIOURS = {
  NORMAL:             'Normal',
  SLOW:               'Slow',
  FAST:               'Fast',
  SUDDEN_STOP:        'Sudden Stop',
  SUDDEN_ACCEL:       'Sudden Acceleration',
  SUDDEN_TURN:        'Sudden Turn',
  LANE_CHANGE:        'Lane Change',
  WRONG_SIDE:         'Wrong-Side Movement',
  RANDOM_CROSSING:    'Random Crossing',
  PEDESTRIAN_CROSS:   'Pedestrian Crossing',
  CATTLE_CROSSING:    'Cattle Crossing',
  INFORMAL_MERGE:     'Informal Merge',
  OVERTAKE:           'Overtake',
  OBSTACLE_AVOID:     'Obstacle Avoidance',
};

// ── Risk levels ───────────────────────────────────────────────
const RISK_LEVELS = [
  { id: 'SAFE',     label: 'SAFE',     color: '#00ff88', bg: '#002a1a', min: 0.00 },
  { id: 'LOW',      label: 'LOW',      color: '#88ff00', bg: '#1a2a00', min: 0.20 },
  { id: 'MEDIUM',   label: 'MEDIUM',   color: '#ffcc00', bg: '#2a1e00', min: 0.45 },
  { id: 'HIGH',     label: 'HIGH',     color: '#ff6600', bg: '#2a1000', min: 0.65 },
  { id: 'CRITICAL', label: 'CRITICAL', color: '#ff0033', bg: '#2a0010', min: 0.83 },
];

// ── Vehicle actions ───────────────────────────────────────────
const ACTIONS = {
  CONTINUE:        { label: 'Continue',        accelFactor:  1.0, steerFactor: 0 },
  SLOW_DOWN:       { label: 'Slow Down',       accelFactor:  0.5, steerFactor: 0 },
  BRAKE:           { label: 'Brake',           accelFactor: -0.5, steerFactor: 0 },
  EMERGENCY_BRAKE: { label: 'Emergency Brake', accelFactor: -1.0, steerFactor: 0 },
  STEER_LEFT:      { label: 'Steer Left',      accelFactor:  0.7, steerFactor: -1 },
  STEER_RIGHT:     { label: 'Steer Right',     accelFactor:  0.7, steerFactor:  1 },
  STOP:            { label: 'Stop',            accelFactor: -2.0, steerFactor: 0 },
  OVERTAKE:        { label: 'Overtake',        accelFactor:  1.3, steerFactor: -1 },
  REROUTE:         { label: 'Re-route',        accelFactor:  0.6, steerFactor: -1.5 },
};

function getRiskLevel(score) {
  let level = RISK_LEVELS[0];
  for (const l of RISK_LEVELS) {
    if (score >= l.min) level = l;
  }
  return level;
}
