import { info } from "console";

/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "selector",
  theme: {
    extend: {
      colors: {
        primary: "#D4DCDA",
        skdk: "#47585C",
        secondary: "#80989B",
        log: {
          info: "#FFFFFF",
          debug: "#9BF256",
          warning: "#EFEE00",
          error: "#FE4344",
        },
        // "secondary-text": "#80989B",
      },
    },
  },
  plugins: [require("daisyui")],
  daisyui: {},
};
