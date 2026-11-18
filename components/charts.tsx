"use client";
// Chart.js registration + palette. Import chart components from react-chartjs-2 in pages,
// and import this module once (side effect) so the scales/elements are registered.
import {
  Chart as ChartJS, ArcElement, BarElement, CategoryScale, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip,
} from "chart.js";

ChartJS.register(ArcElement, BarElement, CategoryScale, LinearScale, LineElement, PointElement, Tooltip, Legend, Filler);
ChartJS.defaults.font.family = "'Open Sans', sans-serif";
ChartJS.defaults.font.size = 11.5;
ChartJS.defaults.color = "rgba(11,42,74,0.7)";
ChartJS.defaults.plugins.legend.display = false;
ChartJS.defaults.maintainAspectRatio = false;

/** Categorical palette, in order. */
export const CHART_COLORS = ["#1B5FA8", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#0B2A4A", "#8FC6EE", "#7A93AC"];
export const TONE_COLORS = { normal: "#1B5FA8", warning: "#B57A1F", critical: "#A8503A", done: "#8FC6EE", neutral: "#BEDBF2" };

export const gridColor = "rgba(11,42,74,0.07)";
