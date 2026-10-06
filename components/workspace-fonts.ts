import localFont from "next/font/local";

export const displayFont = localFont({
  src: "../app/fonts/source-serif-400.ttf",
  weight: "400",
  display: "swap",
  variable: "--workspace-display-font",
});
export const bodyFont = localFont({
  src: [
    { path: "../app/fonts/plex-sans-400.ttf", weight: "400" },
    { path: "../app/fonts/plex-sans-500.ttf", weight: "500" },
  ],
  display: "swap",
  variable: "--workspace-body-font",
});
export const workspaceFontClasses = `${displayFont.variable} ${bodyFont.variable}`;

