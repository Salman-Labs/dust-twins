export type Site = {
  id: string; name: string; place: string; lat: number; lon: number; years: number[] | string;
  cleaning: "calm" | "gusty" | "n/a"; note: string; cell: { lat: number; lon: number };
  clim: number[]; shape: number[]; storm: number; haze: number; var: number; reliability: number; series: number[][];
};
export type Twin = {
  lat: number; lon: number; place: string; famous: string | null; score: number;
  components: { season: number; storminess: number; haze: number; variability: number };
  shift: number; mars_bin: number[]; month_match: number[]; test_months: string[];
  clim: number[]; shape: number[]; storm: number; haze: number; var: number; robust: number; beats_null: boolean;
};
export type TwinFile = { site: string; twins: Twin[]; scale: { lo: number; hi: number } };
export type SiteEvidence = {
  top_score: number; top10_mean: number;
  shuffle: { null_p99: number; null_best: number; cells_above_null: number; cells_scored: number; top10_above_null: number };
  split_years: { spearman: number; top50_overlap: number };
  mars_self_test: { neighbour_percentile: number };
  pressure_sensitivity: { spearman: number; top50_overlap: number };
  famous_in_top10: number;
};
export type Evidence = { sites: Record<string, SiteEvidence>; meta: Record<string, unknown> };

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Mars season for a 30-degree solar-longitude bin (northern hemisphere naming). */
export const marsSeason = (bin: number) => ["N. spring", "N. summer", "N. autumn", "N. winter"][Math.floor(bin / 3)];
export const lsRange = (bin: number) => `Ls ${bin * 30}–${bin * 30 + 30}°`;
export const fmtLatLon = (lat: number, lon: number) =>
  `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? "N" : "S"} ${Math.abs(lon > 180 ? lon - 360 : lon).toFixed(1)}°${(lon > 180 ? lon - 360 : lon) >= 0 ? "E" : "W"}`;
