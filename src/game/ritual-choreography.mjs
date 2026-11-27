// Native pixel frames painted by scripts/draw_ritual_cat.py.
export const RITUAL_SPRITE = Object.freeze({ width: 80, height: 68, columns: 16, feetX: 40, feetY: 55 });

export const RITUAL_INTRO = [
  [0, 305], [1, 125], [2, 107], [3, 108], [4, 257], [5, 138],
  [6, 105], [7, 105], [0, 210], [8, 50], [9, 95], [10, 65],
  [11, 52], [12, 53], [13, 95], [14, 72], [15, 78], [16, 92],
  [17, 88], [18, 39], [19, 33], [20, 58], [21, 70], [22, 50],
];
export const RITUAL_PHRASE = [
  [22, 57], [23, 58], [24, 50], [25, 50], [26, 55], [27, 35],
  [28, 35], [29, 35], [30, 30], [31, 55], [32, 35], [33, 70],
  [34, 43], [35, 42], [36, 70], [37, 70], [38, 60], [39, 60],
  [40, 80], [41, 80], [42, 60], [43, 65], [44, 65], [45, 60],
  [46, 60], [47, 75],
];
const turn = [
  [47, 57], [48, 58], [49, 49], [50, 41], [51, 35], [52, 30],
  [53, 70], [54, 65], [55, 57], [56, 58], [57, 65], [58, 65],
  [59, 95], [60, 40], [61, 40], [62, 45], [63, 45], [64, 77],
  [65, 78], [66, 90], [67, 57], [68, 58], [69, 52], [70, 53],
  [71, 75],
];
const travel = [
  [71, 50], [72, 50], [73, 52], [74, 53], [75, 85], [76, 57],
  [77, 58], [78, 50], [79, 50], [80, 62], [81, 63], [82, 50],
  [83, 50], [84, 90], [85, 75], [86, 90], [87, 45], [88, 40],
  [89, 40], [90, 50], [91, 50], [92, 50], [93, 57], [94, 58],
  [95, 80],
];
export const RITUAL_PHRASES = [RITUAL_PHRASE, turn, travel];

export const RITUAL_FINALE = [
  [22, 90], [96, 90], [97, 80], [98, 80], [99, 65], [100, 65],
  [101, 80], [102, 80], [103, 80], [104, 85], [105, 80], [106, 95],
  [107, 60], [108, 80], [109, 55], [110, 25], [111, 25], [112, 23],
  [113, 32], [114, 60], [115, 80], [116, 75], [117, 40], [118, 35],
  [119, 50], [120, 50], [121, 50], [122, 50], [123, 70], [119, 170],
];
export const RITUAL_OUTRO = [
  [119, 50], [124, 50], [125, 95], [126, 55], [127, 55], [128, 60],
  [129, 60], [130, 62], [131, 63], [132, 62], [133, 63], [134, 57],
  [135, 58], [136, 70], [137, 60], [0, 160],
];

export const RITUAL_TIMELINE = [...RITUAL_INTRO, ...RITUAL_PHRASES.flat(), ...RITUAL_FINALE, ...RITUAL_OUTRO];

const duration = timeline => timeline.reduce((sum, [, ms]) => sum + ms, 0);
export const ritualPreludeMs = 1250;
export const ritualPetMs = 240;
export const ritualIntroMs = duration(RITUAL_INTRO);
export const ritualWoodKnockMs = 1670;
export const ritualTakeoffMs = 1870;
export const ritualFinaleStartMs = RITUAL_PHRASES.reduce((sum, phrase) => sum + duration(phrase), ritualIntroMs);
export const ritualFinalHitMs = ritualFinaleStartMs + 1215;
export const ritualOutroStartMs = ritualFinaleStartMs + duration(RITUAL_FINALE);
export const ritualDanceMs = duration(RITUAL_TIMELINE);
