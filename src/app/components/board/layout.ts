/**
 * Approximate board coordinates (viewBox 0..1000 × 0..820) for rendering the
 * West-Midlands network. Geographic-ish placement; tuned for legibility rather
 * than exact cartography. VERIFY against the printed board for a pixel-faithful
 * layout (pure data — no code change needed).
 */
export const LOCATION_XY: Record<string, { x: number; y: number }> = {
  // Towns
  stoke: { x: 300, y: 70 },
  leek: { x: 430, y: 80 },
  belper: { x: 660, y: 95 },
  derby: { x: 710, y: 180 },
  uttoxeter: { x: 545, y: 185 },
  stone: { x: 360, y: 185 },
  stafford: { x: 320, y: 285 },
  cannock: { x: 390, y: 365 },
  burton: { x: 605, y: 260 },
  tamworth: { x: 565, y: 365 },
  nuneaton: { x: 735, y: 435 },
  coventry: { x: 775, y: 530 },
  walsall: { x: 450, y: 425 },
  wolverhampton: { x: 330, y: 450 },
  coalbrookdale: { x: 180, y: 480 },
  dudley: { x: 365, y: 510 },
  birmingham: { x: 530, y: 480 },
  kidderminster: { x: 300, y: 575 },
  redditch: { x: 565, y: 595 },
  worcester: { x: 360, y: 675 },
  farm1: { x: 245, y: 365 },
  farm2: { x: 295, y: 715 },
  // Merchants (board edge)
  warrington: { x: 250, y: 20 },
  nottingham: { x: 840, y: 120 },
  shrewsbury: { x: 55, y: 430 },
  gloucester: { x: 360, y: 775 },
  oxford: { x: 715, y: 715 },
};

export const BOARD_W = 1000;
export const BOARD_H = 820;
